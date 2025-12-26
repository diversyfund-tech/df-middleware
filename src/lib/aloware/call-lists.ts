import {
	getCallLists,
	createCallList,
	updateCallList,
} from "./client";

/**
 * Sync GHL tags to Aloware call list
 * Creates or updates an Aloware call list based on GHL tags
 */
export async function syncGHLTagsToCallList(
	tagName: string,
	contactIds: string[]
): Promise<import("./types").AlowareCallList> {
	// Find existing list with same name
	const lists = await getCallLists();
	const existingList = lists.find(list => list.name === tagName);

	if (existingList) {
		// Update existing list with new contact IDs
		return updateCallList(existingList.id, { contact_ids: contactIds });
	} else {
		// Create new list
		return createCallList({
			name: tagName,
			description: `Synced from GHL tag: ${tagName}`,
			contact_ids: contactIds,
		});
	}
}

/**
 * Get or create a call list by name
 */
export async function getOrCreateCallList(
	name: string,
	description?: string
): Promise<import("./types").AlowareCallList> {
	const lists = await getCallLists();
	const existing = lists.find(list => list.name === name);

	if (existing) {
		return existing;
	}

	return createCallList({ name, description, contact_ids: [] });
}

