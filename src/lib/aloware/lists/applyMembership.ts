import { db } from "@/server/db";
import { contactMappings, contactListMemberships, syncLog, optoutRegistry } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { addContactsToList, removeContactsFromList } from "@/lib/aloware/client";
import { ensureCallList } from "./ensureCallList";
import { syncGHLContactToAloware } from "@/lib/sync/ghl-contact-sync";
import { getContact } from "@/lib/ghl/client";

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

		// Step 3: If mapping missing, create contact in Aloware
		if (!mapping?.alowareContactId) {
			await syncGHLContactToAloware(ghlContactId, { correlationId: correlation });
			// Reload mapping
			mapping = await db.query.contactMappings.findFirst({
				where: eq(contactMappings.ghlContactId, ghlContactId),
			});
		}

		if (!mapping?.alowareContactId) {
			throw new Error(`Could not resolve Aloware contact ID for GHL contact ${ghlContactId}`);
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

