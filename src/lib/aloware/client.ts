import { env } from "@/env";

const ALOWARE_API_BASE_URL = "https://app.aloware.com/api/v1";

/**
 * Aloware API Client
 * 
 * Provides functions to interact with Aloware API.
 */

/**
 * Make authenticated request to Aloware API
 */
async function alowareRequest<T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> {
	const apiToken = env.ALOWARE_API_TOKEN;

	if (!apiToken) {
		throw new Error("ALOWARE_API_TOKEN is not configured");
	}

	// Add API token to query params
	const url = endpoint.includes("?")
		? `${ALOWARE_API_BASE_URL}${endpoint}&api_token=${apiToken}`
		: `${ALOWARE_API_BASE_URL}${endpoint}?api_token=${apiToken}`;

	const response = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(
			`Aloware API error: ${response.status} ${response.statusText} - ${errorText}`,
		);
	}

	return response.json() as Promise<T>;
}

/**
 * Fetch users from Aloware API
 */
export async function getUsers(): Promise<import("./types").AlowareUser[]> {
	try {
		const data = (await alowareRequest<import("./types").AlowareUser[]>(
			"/webhook/users"
		)) as import("./types").AlowareUser[];
		return Array.isArray(data) ? data : [];
	} catch (error) {
		console.error("[aloware] Error fetching users:", error);
		throw error;
	}
}

/**
 * Get a contact by ID
 */
export async function getContact(contactId: string): Promise<import("./types").AlowareContact | null> {
	try {
		const data = await alowareRequest<import("./types").AlowareContact>(
			`/contacts/${contactId}`
		);
		return data;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("404")) {
			return null;
		}
		console.error("[aloware] Error fetching contact:", error);
		throw error;
	}
}

/**
 * Get a call by ID
 */
export async function getCall(callId: string): Promise<import("./types").AlowareCall | null> {
	try {
		const data = await alowareRequest<import("./types").AlowareCall>(
			`/calls/${callId}`
		);
		return data;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("404") || errorMessage.includes("not found")) {
			return null;
		}
		console.error("[aloware] Error fetching call:", error);
		throw error;
	}
}

/**
 * Search contacts by phone or email
 */
export async function searchContacts(
	phone?: string,
	email?: string
): Promise<import("./types").AlowareContact[]> {
	try {
		const params = new URLSearchParams();
		if (phone) params.append("phone", phone);
		if (email) params.append("email", email);

		const data = await alowareRequest<{ data?: import("./types").AlowareContact[]; contacts?: import("./types").AlowareContact[] }>(
			`/contacts?${params.toString()}`
		);

		if (data.data) return data.data;
		if (data.contacts) return data.contacts;
		return [];
	} catch (error) {
		console.error("[aloware] Error searching contacts:", error);
		return [];
	}
}

/**
 * Create or update a contact
 */
export async function upsertContact(
	contact: Partial<import("./types").AlowareContact>
): Promise<import("./types").AlowareContact> {
	try {
		// Try to find existing contact first
		if (contact.phone_number || contact.email) {
			const existing = await searchContacts(contact.phone_number, contact.email);
			if (existing.length > 0) {
				// Update existing contact
				return updateContact(existing[0].id, contact);
			}
		}

		// Create new contact
		return createContact(contact);
	} catch (error) {
		console.error("[aloware] Error upserting contact:", error);
		throw error;
	}
}

/**
 * Create a contact
 */
export async function createContact(
	contact: Partial<import("./types").AlowareContact>
): Promise<import("./types").AlowareContact> {
	try {
		const data = await alowareRequest<import("./types").AlowareContact>(
			"/contacts",
			{
				method: "POST",
				body: JSON.stringify(contact),
			}
		);
		return data;
	} catch (error) {
		console.error("[aloware] Error creating contact:", error);
		throw error;
	}
}

/**
 * Update a contact
 */
export async function updateContact(
	contactId: string,
	updates: Partial<import("./types").AlowareContact>
): Promise<import("./types").AlowareContact> {
	try {
		const data = await alowareRequest<import("./types").AlowareContact>(
			`/contacts/${contactId}`,
			{
				method: "PUT",
				body: JSON.stringify(updates),
			}
		);
		return data;
	} catch (error) {
		console.error("[aloware] Error updating contact:", error);
		throw error;
	}
}

/**
 * Get call lists
 */
export async function getCallLists(): Promise<import("./types").AlowareCallList[]> {
	try {
		const data = await alowareRequest<{ data?: import("./types").AlowareCallList[]; lists?: import("./types").AlowareCallList[] }>(
			"/call-lists"
		);

		if (data.data) return data.data;
		if (data.lists) return data.lists;
		return [];
	} catch (error) {
		console.error("[aloware] Error fetching call lists:", error);
		return [];
	}
}

/**
 * Get a specific call list
 */
export async function getCallList(listId: string): Promise<import("./types").AlowareCallList | null> {
	try {
		const data = await alowareRequest<import("./types").AlowareCallList>(
			`/call-lists/${listId}`
		);
		return data;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("404")) {
			return null;
		}
		console.error("[aloware] Error fetching call list:", error);
		throw error;
	}
}

/**
 * Create a call list
 */
export async function createCallList(
	list: { name: string; description?: string; contact_ids?: string[] }
): Promise<import("./types").AlowareCallList> {
	try {
		const data = await alowareRequest<import("./types").AlowareCallList>(
			"/call-lists",
			{
				method: "POST",
				body: JSON.stringify(list),
			}
		);
		return data;
	} catch (error) {
		console.error("[aloware] Error creating call list:", error);
		throw error;
	}
}

/**
 * Update a call list
 */
export async function updateCallList(
	listId: string,
	updates: { name?: string; description?: string; contact_ids?: string[] }
): Promise<import("./types").AlowareCallList> {
	try {
		const data = await alowareRequest<import("./types").AlowareCallList>(
			`/call-lists/${listId}`,
			{
				method: "PUT",
				body: JSON.stringify(updates),
			}
		);
		return data;
	} catch (error) {
		console.error("[aloware] Error updating call list:", error);
		throw error;
	}
}

/**
 * Add contacts to a call list
 */
export async function addContactsToList(
	listId: string,
	contactIds: string[]
): Promise<import("./types").AlowareCallList> {
	const list = await getCallList(listId);
	if (!list) {
		throw new Error(`Call list ${listId} not found`);
	}

	const existingIds = list.contact_ids || [];
	const newIds = [...new Set([...existingIds, ...contactIds])];

	return updateCallList(listId, { contact_ids: newIds });
}

/**
 * Remove contacts from a call list
 */
export async function removeContactsFromList(
	listId: string,
	contactIds: string[]
): Promise<import("./types").AlowareCallList> {
	const list = await getCallList(listId);
	if (!list) {
		throw new Error(`Call list ${listId} not found`);
	}

	const existingIds = list.contact_ids || [];
	const newIds = existingIds.filter(id => !contactIds.includes(id));

	return updateCallList(listId, { contact_ids: newIds });
}

