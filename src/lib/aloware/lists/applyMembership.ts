import { db } from "@/server/db";
import { contactMappings, contactListMemberships, syncLog, optoutRegistry, callListRegistry } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { addContactsToList, removeContactsFromList } from "@/lib/aloware/client";
import { ensureCallList } from "./ensureCallList";
import { syncGHLContactToAloware } from "@/lib/sync/ghl-contact-sync";
import { getContact } from "@/lib/ghl/client";
import { env } from "@/env";

interface ApplyMembershipChangeParams {
	ghlContactId: string;
	agentKey: string;
	addListKeys: string[];
	removeListKeys: string[];
	correlationId?: string;
}

/**
 * Apply list membership changes for a contact
 * Handles DNC checks, contact mapping resolution, and Aloware list updates
 */
export async function applyListMembershipChange(
	params: ApplyMembershipChangeParams
): Promise<void> {
	const { ghlContactId, agentKey, addListKeys, removeListKeys, correlationId } = params;
	const correlation = correlationId || `membership-${Date.now()}`;

	// TEMPORARILY DISABLED: Check feature flag for Power Dialer lists
	const enablePowerDialerLists = env.ENABLE_POWER_DIALER_LISTS === "true"; // Default to false (disabled)
	if (!enablePowerDialerLists) {
		console.log(`[applyMembership] Power Dialer lists are disabled (ENABLE_POWER_DIALER_LISTS=false), skipping list operations for contact ${ghlContactId}`);
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "list",
			entityId: ghlContactId,
			sourceId: ghlContactId,
			status: "skipped",
			finishedAt: new Date(),
			errorMessage: "Power Dialer lists are temporarily disabled",
			correlationId: correlation,
		});
		return;
	}

	try {
		// Step 1: DNC defensive check - Query optoutRegistry by phone number
		const ghlContact = await getContact(ghlContactId);
		if (ghlContact?.phone) {
			const optout = await db.query.optoutRegistry.findFirst({
				where: eq(optoutRegistry.phoneNumber, ghlContact.phone),
			});
			if (optout?.status === "opted_out") {
				console.log(`[applyMembership] Contact ${ghlContactId} is opted out, blocking list additions`);
				// Short-circuit and return early (defense in depth)
				await db.insert(syncLog).values({
					direction: "ghl_to_aloware",
					entityType: "list",
					entityId: ghlContactId,
					sourceId: ghlContactId,
					status: "skipped",
					finishedAt: new Date(),
					errorMessage: "Contact is opted out, cannot add to lists",
					correlationId: correlation,
				});
				return;
			}
		}

		// Step 2: Resolve ghlContactId → alowareContactId via contactMappings
		let mapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.ghlContactId, ghlContactId),
		});

		// Step 3: If mapping missing, try to create contact in Aloware
		// Handle gracefully if Aloware API is unavailable or returns errors
		if (!mapping?.alowareContactId) {
			try {
				await syncGHLContactToAloware(ghlContactId, { correlationId: correlation });
				// Reload mapping
				mapping = await db.query.contactMappings.findFirst({
					where: eq(contactMappings.ghlContactId, ghlContactId),
				});
			} catch (syncError) {
				console.error(`[applyMembership] Failed to sync GHL contact ${ghlContactId} to Aloware:`, syncError);
				// Log error but don't fail - we'll try to continue if contact already exists
				// Check if contact might exist in Aloware but mapping is missing
				const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
				if (errorMessage.includes("405") || errorMessage.includes("Method Not Allowed")) {
					console.warn(`[applyMembership] Aloware API returned 405 - API endpoints may be incorrect. Skipping contact sync for ${ghlContactId}`);
					// For now, skip list operations if we can't sync contact
					// TODO: Verify Aloware API endpoints or implement alternative sync method
					throw new Error(`Cannot add to call lists: Aloware contact sync failed (405 Method Not Allowed). Please verify Aloware API endpoints.`);
				}
				// For other errors, still throw to trigger retry
				throw syncError;
			}
		}

		if (!mapping?.alowareContactId) {
			throw new Error(`Could not resolve Aloware contact ID for GHL contact ${ghlContactId}. Contact sync may have failed.`);
		}

		const alowareContactId = mapping.alowareContactId;

		// Step 4: For each addListKey
		for (const listKey of addListKeys) {
			try {
				// Ensure list exists
				const alowareListId = await ensureCallList(agentKey, listKey);

				// Add contact to list
				await addContactsToList(alowareListId, [alowareContactId]);

				// Upsert membership record
				await db
					.insert(contactListMemberships)
					.values({
						contactId: ghlContactId,
						agentKey,
						listKey,
						status: "active",
						reason: "added",
					})
					.onConflictDoUpdate({
						target: [
							contactListMemberships.contactId,
							contactListMemberships.agentKey,
							contactListMemberships.listKey,
						],
						set: {
							status: "active",
							reason: "added",
							updatedAt: new Date(),
						},
					});

				// Log success
				await db.insert(syncLog).values({
					direction: "ghl_to_aloware",
					entityType: "list",
					entityId: ghlContactId,
					sourceId: ghlContactId,
					targetId: alowareListId,
					status: "success",
					finishedAt: new Date(),
					correlationId: correlation,
				});
			} catch (error) {
				console.error(`[applyMembership] Error adding to list ${agentKey}/${listKey}:`, error);
				await db.insert(syncLog).values({
					direction: "ghl_to_aloware",
					entityType: "list",
					entityId: ghlContactId,
					sourceId: ghlContactId,
					status: "error",
					finishedAt: new Date(),
					errorMessage: `Failed to add to list ${agentKey}/${listKey}: ${error instanceof Error ? error.message : "Unknown error"}`,
					correlationId: correlation,
				});
			}
		}

		// Step 5: For each removeListKey
		for (const listKey of removeListKeys) {
			try {
				// Get list ID from registry (skip if not exists)
				const registryEntry = await db.query.callListRegistry.findFirst({
					where: and(
						eq(callListRegistry.agentKey, agentKey),
						eq(callListRegistry.listKey, listKey)
					),
				});

				if (!registryEntry?.alowareListId) {
					console.log(`[applyMembership] List ${agentKey}/${listKey} not found in registry, skipping remove`);
					// Still mark membership as removed
					await db
						.insert(contactListMemberships)
						.values({
							contactId: ghlContactId,
							agentKey,
							listKey,
							status: "removed",
							reason: "removed",
						})
						.onConflictDoUpdate({
							target: [
								contactListMemberships.contactId,
								contactListMemberships.agentKey,
								contactListMemberships.listKey,
							],
							set: {
								status: "removed",
								reason: "removed",
								updatedAt: new Date(),
							},
						});
					continue;
				}

				// Remove contact from list
				await removeContactsFromList(registryEntry.alowareListId, [alowareContactId]);

				// Update membership record
				await db
					.insert(contactListMemberships)
					.values({
						contactId: ghlContactId,
						agentKey,
						listKey,
						status: "removed",
						reason: "removed",
					})
					.onConflictDoUpdate({
						target: [
							contactListMemberships.contactId,
							contactListMemberships.agentKey,
							contactListMemberships.listKey,
						],
						set: {
							status: "removed",
							reason: "removed",
							updatedAt: new Date(),
						},
					});

				// Log success
				await db.insert(syncLog).values({
					direction: "ghl_to_aloware",
					entityType: "list",
					entityId: ghlContactId,
					sourceId: ghlContactId,
					targetId: registryEntry.alowareListId,
					status: "success",
					finishedAt: new Date(),
					correlationId: correlation,
				});
			} catch (error) {
				console.error(`[applyMembership] Error removing from list ${agentKey}/${listKey}:`, error);
				await db.insert(syncLog).values({
					direction: "ghl_to_aloware",
					entityType: "list",
					entityId: ghlContactId,
					sourceId: ghlContactId,
					status: "error",
					finishedAt: new Date(),
					errorMessage: `Failed to remove from list ${agentKey}/${listKey}: ${error instanceof Error ? error.message : "Unknown error"}`,
					correlationId: correlation,
				});
			}
		}
	} catch (error) {
		console.error(`[applyMembership] Error applying membership changes:`, error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "list",
			entityId: ghlContactId,
			sourceId: ghlContactId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId: correlation,
		});
		throw error;
	}
}

