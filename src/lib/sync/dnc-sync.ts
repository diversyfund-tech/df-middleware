import { db } from "@/server/db";
import { optoutRegistry, syncLog, contactMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateContact, addTagsToContact } from "@/lib/ghl/client";
import { getContact } from "@/lib/aloware/client";

/**
 * Sync Contact DNC Updated event to GHL and opt-out registry
 * 
 * This is compliance-critical - ensures DNC status is synced across systems
 */
export async function syncAlowareDNCToGHL(
	alowareContactId: string,
	payload: Record<string, unknown>,
	correlationId: string
): Promise<void> {
	try {
		// Fetch contact to get DNC status and phone
		const contact = await getContact(alowareContactId);
		if (!contact) {
			throw new Error(`Contact ${alowareContactId} not found in Aloware`);
		}

		const phoneNumber = contact.phone_number;
		if (!phoneNumber) {
			console.warn(`[dnc-sync] Contact ${alowareContactId} has no phone number, skipping DNC sync`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "contact",
				entityId: alowareContactId,
				sourceId: alowareContactId,
				status: "skipped",
				finishedAt: new Date(),
				errorMessage: "No phone number for DNC sync",
				correlationId,
			});
			return;
		}

		// Determine DNC status from contact or payload
		const isDNC = contact.is_dnc === true || 
			payload.dnc === true || 
			payload.is_dnc === true ||
			(payload.status && String(payload.status).toLowerCase().includes("dnc"));

		// Update opt-out registry
		await db
			.insert(optoutRegistry)
			.values({
				phoneNumber,
				status: isDNC ? "opted_out" : "opted_in",
				source: "aloware",
				reason: isDNC ? "DNC Updated" : "DNC Removed",
				lastEventAt: new Date(),
			})
			.onConflictDoUpdate({
				target: optoutRegistry.phoneNumber,
				set: {
					status: isDNC ? "opted_out" : "opted_in",
					reason: isDNC ? "DNC Updated" : "DNC Removed",
					lastEventAt: new Date(),
					updatedAt: new Date(),
				},
			});

		// Find or create GHL contact
		let ghlContactId: string;
		const mapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.phoneNumber, phoneNumber),
		});

		if (mapping) {
			ghlContactId = mapping.ghlContactId;
		} else {
			ghlContactId = await getOrCreateContact(undefined, phoneNumber);
			// Create mapping if it doesn't exist
			await db.insert(contactMappings).values({
				alowareContactId: contact.id,
				ghlContactId,
				phoneNumber,
				syncDirection: "bidirectional",
			});
		}

		// Tag GHL contact based on DNC status
		if (isDNC) {
			await addTagsToContact(ghlContactId, ["DNC", "Do Not Call", "SYS:df_middleware_origin"]);
		} else {
			// Remove DNC tags if opted back in (GHL API may not support tag removal, but we log it)
			console.log(`[dnc-sync] DNC removed for ${phoneNumber}, GHL contact ${ghlContactId} - manual tag removal may be needed`);
		}

		// Log success
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "contact",
			entityId: alowareContactId,
			sourceId: alowareContactId,
			targetId: ghlContactId,
			status: "success",
			finishedAt: new Date(),
			errorMessage: `DNC status: ${isDNC ? "opted_out" : "opted_in"}`,
			correlationId,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[dnc-sync] Error syncing DNC status:`, error);

		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "contact",
			entityId: alowareContactId,
			sourceId: alowareContactId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

