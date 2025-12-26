import { db } from "@/server/db";
import { contactMappings, syncLog } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getContact, createContact, updateContact } from "@/lib/ghl/client";
import { searchContacts, createContact as createAlowareContact, updateContact as updateAlowareContact } from "@/lib/aloware/client";
import { mergeContacts } from "@/lib/conflicts/merge";
import { CONTACT_SOURCE_OF_TRUTH } from "@/lib/conflicts/rules";
import type { CanonicalContact } from "@/lib/conflicts/rules";
import type { GHLContact } from "@/lib/ghl/types";
import type { AlowareContact } from "@/lib/aloware/types";

/**
 * Convert GHL contact to canonical format
 */
function ghlToCanonical(ghl: GHLContact): CanonicalContact {
	return {
		firstName: ghl.firstName,
		lastName: ghl.lastName,
		email: ghl.email,
		phone: ghl.phone,
		tags: ghl.tags,
		timezone: ghl.customFields?.timezone as string | undefined,
		address: {
			country: ghl.country,
			state: ghl.state,
			city: ghl.city,
		},
		custom: ghl.customFields,
		updatedAt: ghl.updatedAt || ghl.dateUpdated,
		source: "ghl",
	};
}

/**
 * Convert Aloware contact to canonical format
 */
function alowareToCanonical(aloware: AlowareContact): CanonicalContact {
	return {
		firstName: aloware.first_name,
		lastName: aloware.last_name,
		email: aloware.email,
		phone: aloware.phone_number,
		tags: aloware.disposition_status ? [aloware.disposition_status] : undefined,
		timezone: aloware.timezone,
		address: {
			country: aloware.country,
			state: aloware.state,
			city: aloware.city,
		},
		custom: {
			alowareContactId: aloware.id,
			leadSource: aloware.lead_source,
			intakeSource: aloware.intake_source,
		},
		source: "aloware",
	};
}

/**
 * Ensure contact mapping exists by phone or email
 */
export async function ensureContactMappingByPhoneOrEmail(
	phone?: string,
	email?: string
): Promise<{ ghlContactId: string; alowareContactId: string } | null> {
	if (!phone && !email) {
		return null;
	}

	// Check existing mapping
	const existingMapping = await db.query.contactMappings.findFirst({
		where: phone 
			? eq(contactMappings.phoneNumber, phone)
			: eq(contactMappings.email, email!),
	});

	if (existingMapping && existingMapping.alowareContactId) {
		return {
			ghlContactId: existingMapping.ghlContactId,
			alowareContactId: existingMapping.alowareContactId,
		};
	}

	// Try to find contacts in both systems
	const ghlContact = phone || email 
		? await import("@/lib/ghl/client").then(m => m.searchContact(email, phone))
		: null;
	
	const alowareContacts = phone || email
		? await import("@/lib/aloware/client").then(m => m.searchContacts(phone, email))
		: [];

	const alowareContact = alowareContacts.length > 0 ? alowareContacts[0] : null;

	if (ghlContact && alowareContact) {
		// Create mapping
		await db.insert(contactMappings).values({
			alowareContactId: alowareContact.id,
			ghlContactId: ghlContact.id,
			phoneNumber: phone || null,
			email: email || null,
			syncDirection: "bidirectional",
		});

		return {
			ghlContactId: ghlContact.id,
			alowareContactId: alowareContact.id,
		};
	}

	return null;
}

/**
 * Sync GHL contact to Aloware
 */
export async function syncGHLContactToAloware(
	ghlContactId: string,
	opts?: { correlationId?: string }
): Promise<string> {
	const correlationId = opts?.correlationId || `ghl-contact-sync-${Date.now()}`;

	try {
		// Load GHL contact
		const ghlContact = await getContact(ghlContactId);
		const ghlCanonical = ghlToCanonical(ghlContact);

		// Resolve Aloware contact
		let alowareContactId: string;
		const existingMapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.ghlContactId, ghlContactId),
		});

		let alowareContact: AlowareContact | null = null;

		if (existingMapping && existingMapping.alowareContactId) {
			alowareContactId = existingMapping.alowareContactId;
			// Try to fetch Aloware contact using phone number from mapping
			const phoneForLookup = existingMapping.phoneNumber || ghlContact.phone;
			if (phoneForLookup) {
				alowareContact = await import("@/lib/aloware/client").then(m => m.getContact(alowareContactId, phoneForLookup));
			}
		} else {
			// Search by phone/email
			const alowareContacts = await searchContacts(ghlContact.phone, ghlContact.email);
			if (alowareContacts.length > 0) {
				alowareContact = alowareContacts[0];
				alowareContactId = alowareContact.id;
				// Create mapping
				await db.insert(contactMappings).values({
					alowareContactId,
					ghlContactId,
					phoneNumber: ghlContact.phone || null,
					email: ghlContact.email || null,
					syncDirection: "bidirectional",
				});
			} else {
				// Create new Aloware contact
				const newContact = await createAlowareContact({
					first_name: ghlContact.firstName,
					last_name: ghlContact.lastName,
					email: ghlContact.email,
					phone_number: ghlContact.phone,
					timezone: ghlContact.customFields?.timezone as string | undefined,
					country: ghlContact.country,
					state: ghlContact.state,
					city: ghlContact.city,
				});
				alowareContact = newContact;
				alowareContactId = newContact.id;
				// Create mapping
				await db.insert(contactMappings).values({
					alowareContactId,
					ghlContactId,
					phoneNumber: ghlContact.phone || null,
					email: ghlContact.email || null,
					syncDirection: "bidirectional",
				});
			}
		}

		// Merge contacts if both exist
		if (alowareContact) {
			const alowareCanonical = alowareToCanonical(alowareContact);
			const { merged } = mergeContacts(ghlCanonical, alowareCanonical);

			// Apply merge based on source of truth
			if (CONTACT_SOURCE_OF_TRUTH === "merge" || CONTACT_SOURCE_OF_TRUTH === "ghl") {
				// Update Aloware with merged data
				// Phone number is required for Aloware API
				if (!merged.phone) {
					console.warn(`[ghl-contact-sync] Cannot update Aloware contact ${alowareContactId}: no phone number`);
				} else {
					await updateAlowareContact(alowareContactId, {
						first_name: merged.firstName,
						last_name: merged.lastName,
						email: merged.email,
						phone_number: merged.phone, // Required for Aloware API
						timezone: merged.timezone,
						country: merged.address?.country,
						state: merged.address?.state,
						city: merged.address?.city,
					});
				}

				// If merge requires updating GHL, do that too
				if (CONTACT_SOURCE_OF_TRUTH === "merge") {
					await updateContact(ghlContactId, {
						firstName: merged.firstName,
						lastName: merged.lastName,
						email: merged.email,
						phone: merged.phone,
						tags: merged.tags,
						customFields: merged.custom,
					});
				}
			}
		}

		// Update mapping lastSyncedAt
		await db
			.update(contactMappings)
			.set({ lastSyncedAt: new Date(), updatedAt: new Date() })
			.where(eq(contactMappings.ghlContactId, ghlContactId));

		// Log success
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "contact",
			entityId: ghlContactId,
			sourceId: ghlContactId,
			targetId: alowareContactId,
			status: "success",
			finishedAt: new Date(),
			correlationId,
		});

		return alowareContactId;
	} catch (error) {
		console.error("[ghl-contact-sync] Error syncing contact:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Log error
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "contact",
			entityId: ghlContactId,
			sourceId: ghlContactId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

