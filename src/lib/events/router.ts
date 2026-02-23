import { db } from "@/server/db";
import { syncLog, webhookEvents, contactMappings, contactAgentState, broadcastWebhookEvents } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { syncAlowareContactToGHL } from "@/lib/sync/contact-sync";
import { syncAlowareCallToGHL } from "@/lib/sync/call-sync";
import { syncGHLTagToAlowareList } from "@/lib/sync/list-sync";
import { syncGHLContactToAloware } from "@/lib/sync/ghl-contact-sync";
import { getContact, getCall } from "@/lib/aloware/client";
import { extractTagNameFromGhlPayload } from "@/lib/ghl/tags";
import { detectMiddlewareOrigin } from "@/lib/loops/origin";
import { syncAlowareDNCToGHL } from "@/lib/sync/dnc-sync";
import { syncAlowareTranscriptionToGHL } from "@/lib/sync/transcription-sync";
import { syncAlowareCallSummaryToGHL } from "@/lib/sync/call-summary-sync";
import { syncAlowareRecordingToGHL } from "@/lib/sync/recording-sync";
import { syncAlowareVoicemailToGHL } from "@/lib/sync/voicemail-sync";
import { syncAlowareCommunicationToGHL } from "@/lib/sync/communication-sync";
import { addTagsToContact, getContact as getGhlContact } from "@/lib/ghl/client";
import { env } from "@/env";
import { resolveAgentForGhlContact } from "@/lib/agents/resolveAgent";
import { resolveListKeysForEvent } from "@/lib/lists/resolveListIntent";
import { applyListMembershipChange } from "@/lib/aloware/lists/applyMembership";
import { detectAndHandleReassignment } from "@/lib/agents/detectReassignment";
import { handleAlowareListStatusChange } from "@/lib/aloware/sequences/enrollHandler";
import { findBroadcastsForContactByPhoneOrEmail } from "@/lib/broadcasts/find-broadcasts-by-contact";
import { startBoss, BROADCAST_EVENT_QUEUE } from "@/lib/jobs/boss";
import { logger } from "@/lib/logger";
import { syncOperationsTotal, syncOperationDuration } from "@/lib/metrics";
import { SYNC_DIRECTION, ENTITY_TYPE, SYNC_STATUS, WEBHOOK_SOURCES } from "@/lib/constants";

type WebhookEvent = typeof webhookEvents.$inferSelect;

/**
 * Route webhook event to appropriate sync handler
 */
export async function routeWebhookEvent(event: WebhookEvent): Promise<void> {
	const correlationId = event.id;
	const syncStartTime = Date.now();

	try {
		// Check for loop prevention (middleware-originated events)
		const origin = detectMiddlewareOrigin(event.source, event.payloadJson);
		if (origin.isOrigin) {
			logger.info({
				eventId: event.id,
				source: event.source,
				entityType: event.entityType,
			}, "Event is middleware-originated, skipping sync");
			// Mark as done without syncing
			await db.insert(syncLog).values({
				direction: event.source === "aloware" ? SYNC_DIRECTION.ALOWARE_TO_GHL : SYNC_DIRECTION.GHL_TO_ALOWARE,
				entityType: event.entityType,
				entityId: event.entityId,
				sourceId: event.entityId,
				status: SYNC_STATUS.SUCCESS,
				finishedAt: new Date(),
				errorMessage: "middleware-originated",
				correlationId,
			});
			return;
		}

		if (event.source === "aloware") {
			await routeAlowareEvent(event, correlationId);
		} else if (event.source === "ghl") {
			await routeGhLEvent(event, correlationId);
		} else {
			logger.warn({ eventId: event.id, source: event.source }, "Unknown webhook source");
			// Mark as done with log entry
			await db.insert(syncLog).values({
				direction: "unknown",
				entityType: event.entityType,
				entityId: event.entityId,
				sourceId: event.entityId,
				status: SYNC_STATUS.ERROR,
				finishedAt: new Date(),
				errorMessage: `Unknown source: ${event.source}`,
				correlationId,
			});
		}

		// Record sync operation metrics
		const syncDuration = (Date.now() - syncStartTime) / 1000;
		const direction = event.source === "aloware" ? SYNC_DIRECTION.ALOWARE_TO_GHL : SYNC_DIRECTION.GHL_TO_ALOWARE;
		syncOperationsTotal.inc({
			direction,
			entity_type: event.entityType,
			status: SYNC_STATUS.SUCCESS,
		});
		syncOperationDuration.observe({ direction, entity_type: event.entityType }, syncDuration);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		const syncDuration = (Date.now() - syncStartTime) / 1000;
		const direction = event.source === "aloware" ? SYNC_DIRECTION.ALOWARE_TO_GHL : SYNC_DIRECTION.GHL_TO_ALOWARE;

		logger.error({
			eventId: event.id,
			source: event.source,
			error,
		}, "Error routing webhook event");

		// Record error metrics
		syncOperationsTotal.inc({
			direction,
			entity_type: event.entityType,
			status: SYNC_STATUS.ERROR,
		});
		syncOperationDuration.observe({ direction, entity_type: event.entityType }, syncDuration);

		// Log error
		await db.insert(syncLog).values({
			direction,
			entityType: event.entityType,
			entityId: event.entityId,
			sourceId: event.entityId,
			status: SYNC_STATUS.ERROR,
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

/**
 * Route Aloware webhook events
 * 
 * Policy: GHL is source of truth for contacts
 * - Aloware contact events (Created/Updated/Disposed) are skipped
 * - Other events sync to GHL for enrichment
 */
async function routeAlowareEvent(event: WebhookEvent, correlationId: string): Promise<void> {
	const payload = event.payloadJson as Record<string, unknown>;

	// GHL Source of Truth Policy: Skip Aloware contact events
	if (event.entityType === "contact") {
		const eventTypeLower = event.eventType.toLowerCase();
		
		// Contact DNC Updated - HIGH PRIORITY (compliance)
		if (eventTypeLower.includes("dnc") || eventTypeLower.includes("do not call")) {
			await syncAlowareDNCToGHL(event.entityId, payload, correlationId);
			return;
		}

		// Contact Disposed - Map disposition to GHL tags
		if (eventTypeLower.includes("disposed")) {
			await handleContactDisposed(event.entityId, payload, correlationId);
			return;
		}

		// Exception: Handle aloware_list_status changes for sequence enrollment
		// This happens after GHL→Aloware sync updates the contact
		// TEMPORARILY DISABLED: Check feature flag
		const enableSequences = env.ENABLE_ALOWARE_SEQUENCES === "true"; // Default to false (disabled)
		if (enableSequences && (eventTypeLower.includes("updated") || eventTypeLower.includes("changed"))) {
			// Extract aloware_list_status from payload
			const customFields = (payload.customFields || payload.custom_fields || payload.custom) as Record<string, unknown> | undefined;
			const alowareListStatus = customFields?.aloware_list_status as string | undefined;
			
			// Extract phone number (required for sequence enrollment)
			const phoneNumber = (payload.phone_number || payload.phone || payload.phoneNumber) as string | undefined;

			if (alowareListStatus !== undefined && phoneNumber) {
				// Look up GHL contact ID from mapping (contactAgentState uses GHL contact ID)
				const mapping = await db.query.contactMappings.findFirst({
					where: eq(contactMappings.alowareContactId, event.entityId),
				});

				const ghlContactId = mapping?.ghlContactId;

				// Check if status changed (for idempotency) - only if we have GHL contact ID
				let previousStatus: string | undefined;
				if (ghlContactId) {
					const existingState = await db.query.contactAgentState.findFirst({
						where: eq(contactAgentState.contactId, ghlContactId),
					});
					previousStatus = existingState?.lastAlowareListStatus as string | undefined;
				}
				
				// Only process if status changed (or if we don't have previous status)
				if (previousStatus !== alowareListStatus) {
					logger.info({
						alowareContactId: event.entityId,
						previousStatus: previousStatus || "null",
						newStatus: alowareListStatus,
					}, "Detected aloware_list_status change");
					
					try {
						await handleAlowareListStatusChange({
							phoneNumber,
							status: alowareListStatus,
							correlationId,
						});

						// Update contactAgentState with new status (if we have GHL contact ID)
						if (ghlContactId) {
							const existingState = await db.query.contactAgentState.findFirst({
								where: eq(contactAgentState.contactId, ghlContactId),
							});

							if (existingState) {
								await db
									.update(contactAgentState)
									.set({
										lastAlowareListStatus: alowareListStatus,
										updatedAt: new Date(),
									})
									.where(eq(contactAgentState.contactId, ghlContactId));
							}
							// Note: We don't create contactAgentState here if it doesn't exist
							// because we need agentKey. The agent-managed list sync will create it when needed.
						}
					} catch (error) {
						logger.error({
							alowareContactId: event.entityId,
							error,
						}, "Error handling aloware_list_status change");
						// Don't throw - continue with normal skip logic
					}
				} else {
					logger.info({
						alowareContactId: event.entityId,
						status: alowareListStatus,
					}, "aloware_list_status unchanged, skipping sequence enrollment");
				}
			}
		}

		// Contact Created/Updated - SKIP (GHL is source of truth)
		logger.info({
			eventId: event.id,
			eventType: event.eventType,
			source: event.source,
		}, "Skipping Aloware contact event - GHL is source of truth");
		await db.insert(syncLog).values({
			direction: SYNC_DIRECTION.ALOWARE_TO_GHL,
			entityType: ENTITY_TYPE.CONTACT,
			entityId: event.entityId,
			sourceId: event.entityId,
			status: SYNC_STATUS.SKIPPED,
			finishedAt: new Date(),
			errorMessage: "aloware_contact_event_ignored_source_of_truth_is_ghl",
			correlationId,
		});
		return;
	}

	// Call Disposed - Process call data
	if (event.entityType === "call") {
		const call = await getCall(event.entityId);
		if (!call) {
			throw new Error(`Call ${event.entityId} not found in Aloware`);
		}

		if (!call.contact_id) {
			throw new Error(`Call ${event.entityId} has no contact_id`);
		}

		const contact = await getContact(call.contact_id);
		if (!contact) {
			throw new Error(`Contact ${call.contact_id} not found for call ${event.entityId}`);
		}

		await syncAlowareCallToGHL(call, contact, correlationId);
		return;
	}

	// Transcription Saved - HIGH PRIORITY (AI/CRM enrichment)
	if (event.entityType === "transcription") {
		await syncAlowareTranscriptionToGHL(event.entityId, payload, correlationId);
		return;
	}

	// Call Summarized - HIGH PRIORITY (CRM/follow-ups)
	if (event.entityType === "call_summary") {
		await syncAlowareCallSummaryToGHL(event.entityId, payload, correlationId);
		return;
	}

	// Recording Saved - VALUABLE (evidence/AI)
	if (event.entityType === "recording") {
		await syncAlowareRecordingToGHL(event.entityId, payload, correlationId);
		return;
	}

	// Voicemail Saved - Nice-to-have
	if (event.entityType === "voicemail") {
		await syncAlowareVoicemailToGHL(event.entityId, payload, correlationId);
		return;
	}

	// Communication Initiated/Disposed - Store + skipped initially
	if (event.entityType === "communication") {
		const eventTypeLower = event.eventType.toLowerCase();
		const commType = eventTypeLower.includes("initiated") ? "initiated" : "disposed";
		await syncAlowareCommunicationToGHL(event.entityId, commType, payload, correlationId);
		return;
	}

	// Appointment Saved - SKIP (GHL is source of truth for appointments)
	if (event.entityType === ENTITY_TYPE.APPOINTMENT) {
		logger.info({
			eventId: event.id,
			eventType: event.eventType,
		}, "Skipping Aloware appointment event - GHL is source of truth");
		await db.insert(syncLog).values({
			direction: SYNC_DIRECTION.ALOWARE_TO_GHL,
			entityType: ENTITY_TYPE.APPOINTMENT,
			entityId: event.entityId,
			sourceId: event.entityId,
			status: SYNC_STATUS.SKIPPED,
			finishedAt: new Date(),
			errorMessage: "appointments_sot_is_ghl",
			correlationId,
		});
		return;
	}

	// Unknown/unhandled event type - Skip gracefully (don't error)
	logger.info({
		eventId: event.id,
		entityType: event.entityType,
		eventType: event.eventType,
	}, "Unhandled Aloware event type");
	await db.insert(syncLog).values({
		direction: SYNC_DIRECTION.ALOWARE_TO_GHL,
		entityType: event.entityType,
		entityId: event.entityId,
		sourceId: event.entityId,
		status: SYNC_STATUS.SKIPPED,
		finishedAt: new Date(),
		errorMessage: `Unhandled event type: ${event.eventType}`,
		correlationId,
	});
}

/**
 * Handle Contact Disposed event
 * Maps disposition to GHL tags and pipeline stage
 */
async function handleContactDisposed(
	contactId: string,
	payload: Record<string, unknown>,
	correlationId: string
): Promise<void> {
	try {
		// Fetch contact to get disposition
		const contact = await getContact(contactId);
		if (!contact) {
			throw new Error(`Contact ${contactId} not found in Aloware`);
		}

		// Extract disposition from contact or payload
		const disposition = contact.disposition_status as string || 
			payload.disposition as string || 
			payload.status as string ||
			"Unknown";

		// Find GHL contact via mapping
		const mapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.alowareContactId, contactId),
		});

		if (!mapping) {
			logger.warn({ alowareContactId: contactId }, "No mapping found for Aloware contact");
			await db.insert(syncLog).values({
				direction: SYNC_DIRECTION.ALOWARE_TO_GHL,
				entityType: ENTITY_TYPE.CONTACT,
				entityId: contactId,
				sourceId: contactId,
				status: SYNC_STATUS.SKIPPED,
				finishedAt: new Date(),
				errorMessage: "No contact mapping found",
				correlationId,
			});
			return;
		}

		const ghlContactId = mapping.ghlContactId;

		// Add disposition tag to GHL contact
		await addTagsToContact(ghlContactId, [
			`Disposition: ${disposition}`,
			"Contact Disposed",
			"SYS:df_middleware_origin"
		]);

		// Log success
		await db.insert(syncLog).values({
			direction: SYNC_DIRECTION.ALOWARE_TO_GHL,
			entityType: ENTITY_TYPE.CONTACT,
			entityId: contactId,
			sourceId: contactId,
			targetId: ghlContactId,
			status: SYNC_STATUS.SUCCESS,
			finishedAt: new Date(),
			errorMessage: `Disposition: ${disposition}`,
			correlationId,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.error({
			alowareContactId: contactId,
			error,
		}, "Error handling contact disposed");

		await db.insert(syncLog).values({
			direction: SYNC_DIRECTION.ALOWARE_TO_GHL,
			entityType: ENTITY_TYPE.CONTACT,
			entityId: contactId,
			sourceId: contactId,
			status: SYNC_STATUS.ERROR,
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

/**
 * Route GHL webhook events
 */
async function routeGhLEvent(event: WebhookEvent, correlationId: string): Promise<void> {
	const enableAgentListSync = env.ENABLE_AGENT_LIST_SYNC !== "false"; // Default to true

	// Handle tag events (legacy sync + agent-managed lists)
	if (event.entityType === "tag" || event.eventType.includes("tag")) {
		// Legacy tag sync (for backward compatibility)
		const tagName = extractTagNameFromGhlPayload(event.payloadJson);
		if (tagName) {
			await syncGHLTagToAlowareList(tagName, correlationId);
		}

		// Agent-managed list sync (if enabled)
		if (enableAgentListSync) {
			try {
				// Extract contactId from payload (tag events should include contact info)
				const contactId = (event.payloadJson as any)?.contactId || 
					(event.payloadJson as any)?.contact?.id || 
					event.entityId;
				
				if (contactId) {
					// Fetch full contact to get current tags/owner
					const contact = await getGhlContact(contactId);
					if (contact) {
						// Resolve agent
						const { agentKey } = await resolveAgentForGhlContact(contact);
						
						// Resolve list intent (tag events directly map to listKeys)
						const listIntent = await resolveListKeysForEvent(event.eventType, event.payloadJson, contact);
						
						// Apply membership changes
						if (listIntent.add.length > 0 || listIntent.remove.length > 0) {
							await applyListMembershipChange({
								ghlContactId: contactId,
								agentKey,
								addListKeys: listIntent.add,
								removeListKeys: listIntent.remove,
								correlationId,
							});
						}
					}
				}
			} catch (error) {
				console.error(`[router] Error processing tag event for agent lists:`, error);
				// Don't throw - continue with legacy sync
			}
		}
		return;
	}

	// Handle contact events
	if (event.entityType === "contact") {
		// Sync tags from GHL contact (for all contact events)
		if (event.eventType === "contact.created" || event.eventType === "contact.updated" || event.eventType === "contact.changed") {
			try {
				const { syncTagsFromWebhook } = await import("@/lib/sync/tag-sync");
				await syncTagsFromWebhook(event.payloadJson, event.entityId, correlationId);
			} catch (tagError) {
				logger.warn({
					contactId: event.entityId,
					error: tagError,
				}, "Error syncing tags for contact");
				// Don't throw - tag sync is not critical
			}
		}

		// Agent-managed list sync (if enabled)
		// Note: We only sync contacts to Aloware when needed for call lists (GHL is source of truth)
		if (enableAgentListSync && (event.eventType === "contact.created" || event.eventType === "contact.updated" || event.eventType === "contact.changed")) {
			try {
				// Fetch full contact from GHL API (defensive: payload may be incomplete)
				const contact = await getGhlContact(event.entityId);
				if (!contact) {
					console.warn(`[router] Contact ${event.entityId} not found in GHL`);
					return;
				}

				// Resolve agent
				const { agentKey } = await resolveAgentForGhlContact(contact);

				// Check existing state before reassignment detection
				const existingStateBefore = await db.query.contactAgentState.findFirst({
					where: eq(contactAgentState.contactId, event.entityId),
				});

				// Detect and handle reassignment (if agent changed)
				await detectAndHandleReassignment(event.entityId, agentKey, contact, correlationId);

				// Only process list intent if this wasn't a reassignment
				// (detectAndHandleReassignment already handled reassignments)
				const wasReassignment = existingStateBefore && existingStateBefore.agentKey !== agentKey;
				if (!wasReassignment) {
					const listIntent = await resolveListKeysForEvent(event.eventType, event.payloadJson, contact);
					
					if (listIntent.add.length > 0 || listIntent.remove.length > 0) {
						await applyListMembershipChange({
							ghlContactId: event.entityId,
							agentKey,
							addListKeys: listIntent.add,
							removeListKeys: listIntent.remove,
							correlationId,
						});
					}
				}
			} catch (error) {
				logger.error({
					contactId: event.entityId,
					error,
				}, "Error processing contact event for agent lists");
				// Don't throw - contact sync already succeeded
			}
		}

		// Handle contact.deleted
		if (event.eventType === "contact.deleted") {
			const mapping = await db.query.contactMappings.findFirst({
				where: eq(contactMappings.ghlContactId, event.entityId),
			});
			if (mapping?.alowareContactId) {
				try {
					// Mark Aloware contact as DNC (Do Not Call) since GHL contact was deleted
					const { updateContact } = await import("@/lib/aloware/client");
					await updateContact(mapping.alowareContactId, {
						is_dnc: true,
						is_blocked: true,
					});
					
					logger.info({
						ghlContactId: event.entityId,
						alowareContactId: mapping.alowareContactId,
					}, "Marked Aloware contact as DNC after GHL contact deletion");
					
					await db.insert(syncLog).values({
						direction: SYNC_DIRECTION.GHL_TO_ALOWARE,
						entityType: ENTITY_TYPE.CONTACT,
						entityId: event.entityId,
						sourceId: event.entityId,
						targetId: mapping.alowareContactId,
						status: SYNC_STATUS.SUCCESS,
						finishedAt: new Date(),
						errorMessage: "Contact marked as DNC in Aloware",
						correlationId,
					});
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error";
					logger.error({
						ghlContactId: event.entityId,
						alowareContactId: mapping.alowareContactId,
						error,
					}, "Error marking Aloware contact as DNC");
					
					await db.insert(syncLog).values({
						direction: SYNC_DIRECTION.GHL_TO_ALOWARE,
						entityType: ENTITY_TYPE.CONTACT,
						entityId: event.entityId,
						sourceId: event.entityId,
						targetId: mapping.alowareContactId,
						status: SYNC_STATUS.ERROR,
						finishedAt: new Date(),
						errorMessage,
						correlationId,
					});
					// Don't throw - log error but continue
				}
			}
		}
		return;
	}

	// Handle appointment events - sync appointment ID to Verity and trigger broadcast analytics recalculation
	if (event.entityType === "appointment" || event.eventType.includes("appointment")) {
		try {
			const payload = event.payloadJson as any;
			const appointmentId = event.entityId || payload.id || payload.appointmentId || payload.appointment?.id;
			
			// Extract contactId from various possible payload structures
			// NOTE: event.entityId is the appointment ID, NOT the contact ID, so don't use it as fallback
			let contactId = payload.contactId || 
			                payload.contact_id || 
			                payload.contact?.id || 
			                payload.contact?.contactId ||
			                payload.appointment?.contactId ||
			                payload.body?.contactId ||
			                payload.data?.contactId;
			
			// If contactId is still missing, fetch the appointment from GHL API
			if (appointmentId && !contactId) {
				try {
					logger.info({ appointmentId }, "ContactId missing from payload, fetching appointment from GHL API");
					const { getAppointment } = await import("@/lib/workflows/appointments/ghl-appointment");
					const appointment = await getAppointment(String(appointmentId));
					contactId = appointment.contactId;
					logger.info({ appointmentId, contactId }, "Retrieved contactId from GHL API");
				} catch (fetchError) {
					logger.error({
						appointmentId,
						error: fetchError,
					}, "Failed to fetch appointment from GHL API to get contactId");
					// Continue without contactId - we'll try to match by phone/email below
				}
			}
			
			const phone = payload.phone || payload.contact?.phone || payload.contact?.phoneNumber;
			const email = payload.email || payload.contact?.email;

			// If we still don't have contactId but have phone/email, try to find GHL contact
			if (appointmentId && !contactId && (phone || email)) {
				try {
					logger.info({ phone, email }, "ContactId still missing, searching GHL contact by phone/email");
					const { searchContact } = await import("@/lib/ghl/client");
					const ghlContact = await searchContact(email, phone);
					if (ghlContact) {
						contactId = ghlContact.id;
						logger.info({ contactId, phone, email }, "Found GHL contact ID from phone/email search");
					} else {
						logger.warn({ phone, email }, "Could not find GHL contact by phone/email");
					}
				} catch (searchError) {
					logger.error({
						phone,
						email,
						error: searchError,
					}, "Error searching for GHL contact by phone/email");
					// Continue without contactId - we'll try to match by phone/email below
				}
			}

			// Sync appointment ID to Verity leads table and tags
			if (appointmentId && contactId) {
				try {
					const { syncGHLAppointmentToVerity } = await import("@/lib/sync/appointment-sync");
					await syncGHLAppointmentToVerity(String(appointmentId), String(contactId), correlationId);
					logger.info({
						appointmentId,
						contactId,
					}, "Synced appointment to Verity");
					
					// Also sync tags from the contact
					try {
						const { syncTagsFromGHL } = await import("@/lib/sync/tag-sync");
						await syncTagsFromGHL(String(contactId), correlationId);
					} catch (tagError) {
						logger.warn({
							contactId,
							error: tagError,
						}, "Error syncing tags for contact");
						// Don't throw - tag sync is not critical
					}
				} catch (syncError) {
					logger.error({
						appointmentId,
						contactId,
						error: syncError,
					}, "Error syncing appointment to Verity");
					// Don't throw - continue with broadcast analytics recalculation
				}
			} else if (appointmentId && !contactId) {
				logger.warn({
					appointmentId,
					phone,
					email,
				}, "Cannot sync appointment to Verity: missing contactId and could not resolve from phone/email");
			}

			if (contactId || phone || email) {
				logger.info({
					contactId: contactId || phone || email,
					appointmentId,
				}, "Processing appointment event");

				// Find broadcasts for this contact
				let broadcastIds: string[] = [];
				if (contactId) {
					// Try to find contact in Verity DB by matching GHL contact ID
					// Note: We need to match by phone/email since Verity uses its own contact IDs
					// For now, use phone/email matching
					broadcastIds = await findBroadcastsForContactByPhoneOrEmail(phone, email);
				} else {
					broadcastIds = await findBroadcastsForContactByPhoneOrEmail(phone, email);
				}

				if (broadcastIds.length > 0) {
					console.log(`[router] Found ${broadcastIds.length} broadcasts for contact, triggering analytics recalculation`);

					// Enqueue broadcast analytics recalculation for each affected broadcast
					const boss = await startBoss();
					const { createHash } = await import("crypto");
					
					for (const broadcastId of broadcastIds) {
						try {
							// Create a broadcast webhook event to trigger recalculation
							const dedupeKey = createHash("sha256")
								.update(`broadcast:${broadcastId}:analytics_updated:appointment:${Date.now()}`)
								.digest("hex")
								.substring(0, 16);

							const inserted = await db
								.insert(broadcastWebhookEvents)
								.values({
									broadcastId,
									eventType: "analytics_updated",
									payloadJson: {
										triggeredBy: "ghl_appointment",
										appointmentId: event.entityId,
										contactId,
									},
									dedupeKey: `broadcast:${broadcastId}:analytics_updated:appointment:${dedupeKey}`,
									status: "pending",
								})
								.returning({ id: broadcastWebhookEvents.id })
								.onConflictDoNothing({ target: broadcastWebhookEvents.dedupeKey });

							if (inserted && inserted.length > 0) {
								await boss.send(BROADCAST_EVENT_QUEUE, {
									broadcastEventId: inserted[0].id,
								}, {
									retryLimit: 10,
									retryDelay: 60,
									retryBackoff: true,
								});
								console.log(`[router] Enqueued broadcast analytics recalculation for broadcast ${broadcastId}`);
							}
						} catch (enqueueError) {
							console.error(`[router] Error enqueueing broadcast recalculation for ${broadcastId}:`, enqueueError);
							// Don't throw - continue with other broadcasts
						}
					}
				} else {
					console.log(`[router] No broadcasts found for contact ${contactId || phone || email}`);
				}
			}
		} catch (error) {
			console.error(`[router] Error processing appointment event:`, error);
			// Don't throw - appointment webhook processing continues
		}
		return;
	}

	// Handle pipeline/opportunity events (if present)
	if (enableAgentListSync && (event.eventType === "opportunity.statusChanged" || event.eventType === "pipeline.stageChanged")) {
		try {
			const contactId = (event.payloadJson as any)?.contactId || event.entityId;
			if (contactId) {
				// Fetch full contact
				const contact = await getGhlContact(contactId);
				if (contact) {
					// Resolve agent
					const { agentKey } = await resolveAgentForGhlContact(contact);
					
					// Resolve list intent based on pipeline stage
					const listIntent = await resolveListKeysForEvent(event.eventType, event.payloadJson, contact);
					
					// Apply membership changes
					if (listIntent.add.length > 0 || listIntent.remove.length > 0) {
						await applyListMembershipChange({
							ghlContactId: contactId,
							agentKey,
							addListKeys: listIntent.add,
							removeListKeys: listIntent.remove,
							correlationId,
						});
					}
				}
			}
		} catch (error) {
			logger.error({
				eventId: event.id,
				error,
			}, "Error processing pipeline event for agent lists");
			// Don't throw - mark as skipped
		}
		return;
	}

	// Unknown/unhandled GHL event type - Skip gracefully (never throw)
	logger.info({
		eventId: event.id,
		entityType: event.entityType,
		eventType: event.eventType,
	}, "Unhandled GHL event type");
	await db.insert(syncLog).values({
		direction: SYNC_DIRECTION.GHL_TO_ALOWARE,
		entityType: event.entityType,
		entityId: event.entityId,
		sourceId: event.entityId,
		status: SYNC_STATUS.SKIPPED,
		finishedAt: new Date(),
		errorMessage: `Unhandled GHL event type: ${event.eventType}`,
		correlationId,
	});
}

