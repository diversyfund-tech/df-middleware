import { db } from "@/server/db";
import { contactMappings, syncLog } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { syncContactToGHL, findGHLContact } from "@/lib/ghl/contacts";
import type { AlowareContact } from "@/lib/aloware/types";

/**
 * Sync Aloware contact to GHL
 * Creates or updates GHL contact and stores mapping
 */
export async function syncAlowareContactToGHL(
	alowareContact: AlowareContact,
	correlationId?: string
): Promise<string> {
	const alowareContactId = String(alowareContact.id);
	const correlation = correlationId || `contact-sync-${Date.now()}`;

	try {
		// Check if mapping already exists
		const existingMapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.alowareContactId, alowareContactId),
		});

		if (existingMapping) {
			// Update existing GHL contact
			const ghlContact = await syncContactToGHL(
				alowareContact.email,
				alowareContact.phone_number,
				alowareContact.first_name,
				alowareContact.last_name,
				{
					tags: alowareContact.disposition_status ? [alowareContact.disposition_status] : undefined,
					customFields: {
						alowareContactId: alowareContactId,
						leadSource: alowareContact.lead_source,
						intakeSource: alowareContact.intake_source,
						timezone: alowareContact.timezone,
						country: alowareContact.country,
						state: alowareContact.state,
						city: alowareContact.city,
					},
				}
			);

			// Update mapping
			await db
				.update(contactMappings)
				.set({
					ghlContactId: ghlContact,
					phoneNumber: alowareContact.phone_number || null,
					email: alowareContact.email || null,
					lastSyncedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(contactMappings.alowareContactId, alowareContactId));

			// Log success
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "contact",
				entityId: alowareContactId,
				sourceId: alowareContactId,
				targetId: ghlContact,
				status: "success",
				finishedAt: new Date(),
				correlationId: correlation,
			});

			return ghlContact;
		} else {
			// Try to find existing GHL contact by phone/email
			const existingGHLContact = await findGHLContact(
				alowareContact.email,
				alowareContact.phone_number
			);

			let ghlContactId: string;

			if (existingGHLContact) {
				// Use existing GHL contact
				ghlContactId = existingGHLContact.id;

				// Update GHL contact with Aloware data
				await syncContactToGHL(
					alowareContact.email,
					alowareContact.phone_number,
					alowareContact.first_name,
					alowareContact.last_name,
					{
						tags: alowareContact.disposition_status ? [alowareContact.disposition_status] : undefined,
						customFields: {
							alowareContactId: alowareContactId,
							leadSource: alowareContact.lead_source,
							intakeSource: alowareContact.intake_source,
							timezone: alowareContact.timezone,
							country: alowareContact.country,
							state: alowareContact.state,
							city: alowareContact.city,
						},
					}
				);
			} else {
				// Create new GHL contact
				ghlContactId = await syncContactToGHL(
					alowareContact.email,
					alowareContact.phone_number,
					alowareContact.first_name,
					alowareContact.last_name,
					{
						tags: alowareContact.disposition_status ? [alowareContact.disposition_status] : undefined,
						customFields: {
							alowareContactId: alowareContactId,
							leadSource: alowareContact.lead_source,
							intakeSource: alowareContact.intake_source,
							timezone: alowareContact.timezone,
							country: alowareContact.country,
							state: alowareContact.state,
							city: alowareContact.city,
						},
					}
				);
			}

			// Create mapping
			await db.insert(contactMappings).values({
				alowareContactId,
				ghlContactId,
				phoneNumber: alowareContact.phone_number || null,
				email: alowareContact.email || null,
				syncDirection: "aloware_to_ghl",
				lastSyncedAt: new Date(),
			});

			// Log success
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "contact",
				entityId: alowareContactId,
				sourceId: alowareContactId,
				targetId: ghlContactId,
				status: "success",
				finishedAt: new Date(),
				correlationId: correlation,
			});

			return ghlContactId;
		}
	} catch (error) {
		console.error("[contact-sync] Error syncing contact:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Log error
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "contact",
			entityId: alowareContactId,
			sourceId: alowareContactId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId: correlation,
		});

		throw error;
	}
}

/**
 * Get GHL contact ID for an Aloware contact ID
 */
export async function getGHLContactId(alowareContactId: string): Promise<string | null> {
	const mapping = await db.query.contactMappings.findFirst({
		where: eq(contactMappings.alowareContactId, alowareContactId),
	});

	return mapping?.ghlContactId || null;
}

