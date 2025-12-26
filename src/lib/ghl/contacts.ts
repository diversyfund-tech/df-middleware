import { getOrCreateContact, updateContact, searchContact } from "./client";
import type { GHLContact } from "./types";

/**
 * Sync contact to GHL
 * Returns the GHL contact ID
 */
export async function syncContactToGHL(
	email?: string,
	phone?: string,
	firstName?: string,
	lastName?: string,
	additionalData?: Partial<GHLContact>
): Promise<string> {
	// Get or create contact
	const ghlContactId = await getOrCreateContact(email, phone, firstName, lastName);

	// If additional data provided, update the contact
	if (additionalData && Object.keys(additionalData).length > 0) {
		await updateContact(ghlContactId, additionalData);
	}

	return ghlContactId;
}

/**
 * Find GHL contact by phone or email
 */
export async function findGHLContact(email?: string, phone?: string): Promise<GHLContact | null> {
	return searchContact(email, phone);
}

