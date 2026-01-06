/**
 * Find Broadcasts by Contact
 * 
 * Queries Verity's database to find broadcasts where a contact received messages.
 * Used to trigger analytics recalculation when GHL appointments are created.
 */

import { getVerityDb } from "./verity-db";

/**
 * Find broadcasts for a contact
 * 
 * Returns broadcast IDs where the contact received messages (status 'sent' for SMS, 'delivered'/'opened'/'clicked' for email)
 */
export async function findBroadcastsForContact(contactId: string): Promise<string[]> {
	const db = getVerityDb();

	// First, try to find contact by ID
	const contact = await db`
		SELECT id, phone_e164, email
		FROM contacts
		WHERE id = ${contactId}
	`.then(rows => rows[0]);

	if (!contact) {
		console.warn(`[findBroadcastsForContact] Contact ${contactId} not found in Verity DB`);
		return [];
	}

	// Find broadcast recipients for this contact with delivered status
	// For SMS: status = 'sent' means delivered
	// For email: status IN ('delivered', 'opened', 'clicked') means delivered
	const broadcasts = await db`
		SELECT DISTINCT broadcast_id
		FROM broadcast_recipient
		WHERE contact_id = ${contactId}
		AND (
			status = 'sent' -- SMS delivered
			OR status IN ('delivered', 'opened', 'clicked') -- Email delivered
		)
	`;

	return broadcasts.map(b => b.broadcast_id);
}

/**
 * Find broadcasts for a contact by phone number or email
 * 
 * Useful when we only have phone/email from GHL webhook but not the contact ID
 */
export async function findBroadcastsForContactByPhoneOrEmail(
	phone?: string,
	email?: string
): Promise<string[]> {
	const db = getVerityDb();

	if (!phone && !email) {
		return [];
	}

	// Find contact by phone or email
	const contact = phone
		? await db`
			SELECT id
			FROM contacts
			WHERE phone_e164 = ${phone}
			LIMIT 1
		`.then(rows => rows[0])
		: email
			? await db`
				SELECT id
				FROM contacts
				WHERE email = ${email}
				LIMIT 1
			`.then(rows => rows[0])
			: null;

	if (!contact) {
		return [];
	}

	return findBroadcastsForContact(contact.id);
}


