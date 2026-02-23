/**
 * Appointment Sync
 * 
 * Syncs GHL appointment IDs to Verity leads table for accurate broadcast analytics.
 * When appointments are created/updated in GHL, we update the corresponding lead
 * record in Verity with the ghl_appointment_id.
 */

import { getVerityDb } from "@/lib/broadcasts/verity-db";
import { db } from "@/server/db";
import { contactMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getContact, addTagsToContact } from "@/lib/ghl/client";

/**
 * Sync GHL appointment ID to Verity leads table
 * 
 * @param appointmentId - GHL appointment ID
 * @param ghlContactId - GHL contact ID associated with the appointment
 * @param correlationId - Correlation ID for logging
 */
export async function syncGHLAppointmentToVerity(
	appointmentId: string,
	ghlContactId: string,
	correlationId?: string
): Promise<void> {
	const verityDb = getVerityDb();

	try {
		console.log(`[appointment-sync] Syncing appointment ${appointmentId} for GHL contact ${ghlContactId}`);

		// 1. Find Verity contact_id from GHL contact_id
		// First, try to find via contact_mappings table
		const mapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.ghlContactId, ghlContactId),
		});

		let verityContactId: string | null = null;
		let phone: string | null = null;
		let email: string | null = null;
		let ghlContact: Awaited<ReturnType<typeof getContact>> | null = null;

		if (mapping) {
			// If we have a mapping, we need to find the Verity contact
			// The mapping has phone/email which we can use to find the Verity contact
			phone = mapping.phoneNumber || null;
			email = mapping.email || null;
		} else {
			// No mapping found - fetch GHL contact to get phone/email
			try {
				ghlContact = await getContact(ghlContactId);
				if (ghlContact) {
					phone = ghlContact.phone || null;
					email = ghlContact.email || null;
				}
			} catch (error) {
				console.warn(`[appointment-sync] Could not fetch GHL contact ${ghlContactId}:`, error);
			}
		}

		// 2. Find Verity contact by phone or email
		if (phone || email) {
			let verityContact: { id: string } | null = null;

			if (phone) {
				const contacts = await verityDb`
					SELECT id FROM contacts
					WHERE phone_e164 = ${phone}
					LIMIT 1
				`;
				if (contacts.length > 0) {
					verityContact = contacts[0] as { id: string };
				}
			}

			if (!verityContact && email) {
				const contacts = await verityDb`
					SELECT id FROM contacts
					WHERE email = ${email}
					LIMIT 1
				`;
				if (contacts.length > 0) {
					verityContact = contacts[0] as { id: string };
				}
			}

			if (verityContact) {
				verityContactId = verityContact.id;
			}
		}

		if (!verityContactId) {
			console.warn(`[appointment-sync] Could not find Verity contact for GHL contact ${ghlContactId} (phone: ${phone}, email: ${email})`);
			return;
		}

		// 3. Update or insert lead record with ghl_appointment_id
		// Check if lead exists for this contact
		const existingLead = await verityDb`
			SELECT id FROM leads
			WHERE contact_id = ${verityContactId}
			LIMIT 1
		`;

		if (existingLead.length > 0) {
			// Update existing lead
			await verityDb`
				UPDATE leads
				SET ghl_appointment_id = ${appointmentId},
				    last_activity_at = NOW()
				WHERE contact_id = ${verityContactId}
			`;
			console.log(`[appointment-sync] Updated lead for contact ${verityContactId} with appointment ${appointmentId}`);
		} else {
			// Create new lead record
			await verityDb`
				INSERT INTO leads (contact_id, ghl_appointment_id, created_at, last_activity_at)
				VALUES (${verityContactId}, ${appointmentId}, NOW(), NOW())
			`;
			console.log(`[appointment-sync] Created new lead for contact ${verityContactId} with appointment ${appointmentId}`);
		}

		// 4. Sync tags from GHL contact (add tags without removing existing ones)
		try {
			// Reuse contact if we already fetched it, otherwise fetch now
			if (!ghlContact) {
				ghlContact = await getContact(ghlContactId);
			}
			
			if (ghlContact?.tags && ghlContact.tags.length > 0) {
				// addTagsToContact already handles deduplication and doesn't remove existing tags
				await addTagsToContact(ghlContactId, ghlContact.tags);
				console.log(`[appointment-sync] Synced ${ghlContact.tags.length} tags for contact ${ghlContactId}`);
			}
		} catch (tagError) {
			console.warn(`[appointment-sync] Could not sync tags for contact ${ghlContactId}:`, tagError);
			// Don't throw - tag sync is not critical
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[appointment-sync] Error syncing appointment ${appointmentId}:`, errorMessage);
		throw error;
	}
}

/**
 * Sync appointment from GHL webhook payload
 * 
 * Extracts appointment and contact info from webhook payload and syncs to Verity
 */
export async function syncAppointmentFromWebhook(
	payload: Record<string, unknown>,
	correlationId?: string
): Promise<void> {
	const appointmentId = payload.id || payload.appointmentId || payload.appointment?.id;
	const contactId = payload.contactId || payload.contact?.id || payload.contactId;

	if (!appointmentId || !contactId) {
		console.warn(`[appointment-sync] Missing appointmentId or contactId in webhook payload`);
		return;
	}

	await syncGHLAppointmentToVerity(
		String(appointmentId),
		String(contactId),
		correlationId
	);
}
