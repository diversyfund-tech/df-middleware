/**
 * Tag Sync
 * 
 * Syncs tags from GHL contacts, ensuring tags are added without removing existing ones.
 * Handles deduplication automatically.
 */

import { getGhlContact, addTagsToContact } from "@/lib/ghl/client";

/**
 * Sync tags from GHL contact
 * 
 * Fetches the contact's current tags from GHL and ensures they're all present.
 * This function is idempotent - it won't remove existing tags, only add missing ones.
 * Duplicates are automatically handled by addTagsToContact.
 * 
 * @param ghlContactId - GHL contact ID
 * @param correlationId - Optional correlation ID for logging
 */
export async function syncTagsFromGHL(
	ghlContactId: string,
	correlationId?: string
): Promise<void> {
	try {
		// Fetch current contact from GHL to get tags
		const ghlContact = await getGhlContact(ghlContactId);
		
		if (!ghlContact) {
			console.warn(`[tag-sync] Contact ${ghlContactId} not found in GHL`);
			return;
		}

		const tags = ghlContact.tags || [];
		
		if (tags.length === 0) {
			console.log(`[tag-sync] No tags to sync for contact ${ghlContactId}`);
			return;
		}

		// addTagsToContact merges with existing tags and handles deduplication
		// It won't remove any existing tags, only add new ones
		await addTagsToContact(ghlContactId, tags);
		
		console.log(`[tag-sync] Synced ${tags.length} tags for contact ${ghlContactId}: ${tags.join(", ")}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[tag-sync] Error syncing tags for contact ${ghlContactId}:`, errorMessage);
		throw error;
	}
}

/**
 * Sync tags from GHL webhook payload
 * 
 * Extracts tags from contact/appointment webhook payload and syncs them
 */
export async function syncTagsFromWebhook(
	payload: Record<string, unknown>,
	ghlContactId: string,
	correlationId?: string
): Promise<void> {
	// Extract tags from payload if present
	const tags = payload.tags as string[] || 
	              (payload.contact?.tags as string[]) ||
	              (payload.appointment?.contact?.tags as string[]) ||
	              [];

	if (tags.length > 0) {
		// Add tags (will deduplicate automatically)
		await addTagsToContact(ghlContactId, tags);
		console.log(`[tag-sync] Synced ${tags.length} tags from webhook for contact ${ghlContactId}`);
	} else {
		// If no tags in payload, fetch from GHL API
		await syncTagsFromGHL(ghlContactId, correlationId);
	}
}
