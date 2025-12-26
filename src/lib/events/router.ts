import { db } from "@/server/db";
import { syncLog, webhookEvents, contactMappings, contactAgentState } from "@/server/db/schema";
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

type WebhookEvent = typeof webhookEvents.$inferSelect;

/**
 * Route webhook event to appropriate sync handler
 */
export async function routeWebhookEvent(event: WebhookEvent): Promise<void> {
	const correlationId = event.id;

	try {
		// Check for loop prevention (middleware-originated events)
		const origin = detectMiddlewareOrigin(event.source, event.payloadJson);
		if (origin.isOrigin) {
			console.log(`[router] Event ${event.id} is middleware-originated, skipping sync`);
			// Mark as done without syncing
			await db.insert(syncLog).values({
				direction: event.source === "aloware" ? "aloware_to_ghl" : "ghl_to_aloware",
				entityType: event.entityType,
				entityId: event.entityId,
				sourceId: event.entityId,
				status: "success",
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
			console.warn(`[router] Unknown source: ${event.source}`);
			// Mark as done with log entry
			await db.insert(syncLog).values({
				direction: "unknown",
				entityType: event.entityType,
				entityId: event.entityId,
				sourceId: event.entityId,
				status: "error",
				finishedAt: new Date(),
				errorMessage: `Unknown source: ${event.source}`,
				correlationId,
			});
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[router] Error routing event ${event.id}:`, error);

		// Log error
		await db.insert(syncLog).values({
			direction: event.source === "aloware" ? "aloware_to_ghl" : "ghl_to_aloware",
			entityType: event.entityType,
			entityId: event.entityId,
			sourceId: event.entityId,
			status: "error",
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

		// Contact Created/Updated - SKIP (GHL is source of truth)
		console.log(`[router] Skipping Aloware contact event ${event.eventType} - GHL is source of truth`);
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "contact",
			entityId: event.entityId,
			sourceId: event.entityId,
			status: "skipped",
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
	if (event.entityType === "appointment") {
		console.log(`[router] Skipping Aloware appointment event - GHL is source of truth`);
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "appointment",
			entityId: event.entityId,
			sourceId: event.entityId,
			status: "skipped",
			finishedAt: new Date(),
			errorMessage: "appointments_sot_is_ghl",
			correlationId,
		});
		return;
	}

	// Unknown/unhandled event type - Skip gracefully (don't error)
	console.log(`[router] Unhandled Aloware event type: ${event.entityType} (${event.eventType})`);
	await db.insert(syncLog).values({
		direction: "aloware_to_ghl",
		entityType: event.entityType,
		entityId: event.entityId,
		sourceId: event.entityId,
		status: "skipped",
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
			console.warn(`[contact-disposed] No mapping found for Aloware contact ${contactId}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "contact",
				entityId: contactId,
				sourceId: contactId,
				status: "skipped",
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
			direction: "aloware_to_ghl",
			entityType: "contact",
			entityId: contactId,
			sourceId: contactId,
			targetId: ghlContactId,
			status: "success",
			finishedAt: new Date(),
			errorMessage: `Disposition: ${disposition}`,
			correlationId,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[contact-disposed] Error handling contact disposed:`, error);

		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "contact",
			entityId: contactId,
			sourceId: contactId,
			status: "error",
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
		// Sync GHL contact to Aloware (GHL is source of truth)
		await syncGHLContactToAloware(event.entityId, { correlationId });

		// Agent-managed list sync (if enabled)
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
				console.error(`[router] Error processing contact event for agent lists:`, error);
				// Don't throw - contact sync already succeeded
			}
		}

		// Handle contact.deleted
		if (event.eventType === "contact.deleted") {
			const mapping = await db.query.contactMappings.findFirst({
				where: eq(contactMappings.ghlContactId, event.entityId),
			});
			if (mapping?.alowareContactId) {
				// TODO: Mark Aloware contact as inactive/DNC if API supports it
				console.log(`[router] GHL contact ${event.entityId} deleted, Aloware contact ${mapping.alowareContactId} should be marked inactive`);
				await db.insert(syncLog).values({
					direction: "ghl_to_aloware",
					entityType: "contact",
					entityId: event.entityId,
					sourceId: event.entityId,
					targetId: mapping.alowareContactId,
					status: "skipped",
					finishedAt: new Date(),
					errorMessage: "contact.deleted not fully implemented - manual cleanup may be needed",
					correlationId,
				});
			}
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
			console.error(`[router] Error processing pipeline event for agent lists:`, error);
			// Don't throw - mark as skipped
		}
		return;
	}

	// Unknown/unhandled GHL event type - Skip gracefully (never throw)
	console.log(`[router] Unhandled GHL event type: ${event.entityType} (${event.eventType})`);
	await db.insert(syncLog).values({
		direction: "ghl_to_aloware",
		entityType: event.entityType,
		entityId: event.entityId,
		sourceId: event.entityId,
		status: "skipped",
		finishedAt: new Date(),
		errorMessage: `Unhandled GHL event type: ${event.eventType}`,
		correlationId,
	});
}

