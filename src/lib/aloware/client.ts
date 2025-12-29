import { env } from "@/env";

const ALOWARE_API_BASE_URL = "https://app.aloware.com/api/v1";

/**
 * Aloware API Client
 * 
 * Provides functions to interact with Aloware API.
 */

/**
 * Make authenticated request to Aloware API
 * For GET requests: api_token goes in query params
 * For POST/PUT requests: api_token goes in body (handled by individual functions)
 */
async function alowareRequest<T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> {
	const apiToken = env.ALOWARE_API_TOKEN;

	if (!apiToken) {
		throw new Error("ALOWARE_API_TOKEN is not configured");
	}

	// For GET requests, add API token to query params
	// For POST/PUT, token should be in body (handled by caller)
	const isGet = !options.method || options.method === "GET";
	const url = isGet && endpoint.includes("?")
		? `${ALOWARE_API_BASE_URL}${endpoint}&api_token=${apiToken}`
		: isGet
		? `${ALOWARE_API_BASE_URL}${endpoint}?api_token=${apiToken}`
		: `${ALOWARE_API_BASE_URL}${endpoint}`;

	const response = await fetch(url, {
		...options,
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		// Log the full URL for debugging
		console.error(`[aloware] API request failed: ${url}`);
		console.error(`[aloware] Response status: ${response.status} ${response.statusText}`);
		console.error(`[aloware] Response body: ${errorText.substring(0, 500)}`);
		throw new Error(
			`Aloware API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`,
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
 * NOTE: Aloware API doesn't support getting contacts by ID directly.
 * This function requires a phone number to look up the contact.
 * If you only have an ID, use searchContacts with the phone number instead.
 */
export async function getContact(
	contactId: string,
	phoneNumber?: string
): Promise<import("./types").AlowareContact | null> {
	try {
		// If phone number is provided, use the lookup endpoint
		if (phoneNumber) {
			const contacts = await searchContacts(phoneNumber);
			return contacts.length > 0 ? contacts[0]! : null;
		}

		// Otherwise, we can't look up by ID - return null
		console.warn(`[aloware] getContact called with ID ${contactId} but no phone number. Aloware API requires phone number for contact lookup.`);
		return null;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("404") || errorMessage.includes("not found")) {
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
 * Search contacts by phone number
 * Uses Aloware's webhook API: GET /api/v1/webhook/contact/phone-number
 */
export async function searchContacts(
	phone?: string,
	email?: string
): Promise<import("./types").AlowareContact[]> {
	try {
		// Aloware API only supports phone number lookup
		if (!phone) {
			console.warn("[aloware] searchContacts: phone number required for Aloware API");
			return [];
		}

		// Normalize phone number (remove non-digits, but keep + if present)
		const normalizedPhone = phone.replace(/[^\d+]/g, "");

		// Use the correct endpoint: /webhook/contact/phone-number
		const data = await alowareRequest<import("./types").AlowareContact>(
			`/webhook/contact/phone-number?phone_number=${encodeURIComponent(normalizedPhone)}`
		);

		// API returns single contact object, wrap in array
		return [data];
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		// 404 means contact not found, which is fine
		if (errorMessage.includes("404") || errorMessage.includes("not found")) {
			return [];
		}
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
 * Create or update a contact
 * Uses Aloware's webhook API: POST /api/v1/webhook/forms
 * API token must be in the body, not query params
 */
export async function createContact(
	contact: Partial<import("./types").AlowareContact>
): Promise<import("./types").AlowareContact> {
	try {
		const apiToken = env.ALOWARE_API_TOKEN;
		if (!apiToken) {
			throw new Error("ALOWARE_API_TOKEN is not configured");
		}

		// Normalize phone number (remove non-digits except +)
		const phoneNumber = contact.phone_number?.replace(/[^\d+]/g, "") || "";
		if (!phoneNumber) {
			throw new Error("phone_number is required for Aloware contact creation");
		}

		// Build payload according to Aloware API spec
		const payload: Record<string, unknown> = {
			api_token: apiToken, // Required: token goes in body
			phone_number: phoneNumber, // Required
			force_update: false, // Create mode
		};

		// Map our contact fields to Aloware API fields
		if (contact.first_name) payload.first_name = contact.first_name;
		if (contact.last_name) payload.last_name = contact.last_name;
		if (contact.name) payload.name = contact.name;
		if (contact.email) payload.email = contact.email;
		if (contact.timezone) payload.timezone = contact.timezone;
		if (contact.country) payload.country = contact.country;
		if (contact.state) payload.state = contact.state;
		if (contact.city) payload.city = contact.city;
		if (contact.lead_source) payload.lead_source = contact.lead_source;

		const response = await alowareRequest<{ message: string }>(
			"/webhook/forms",
			{
				method: "POST",
				body: JSON.stringify(payload),
			}
		);

		// After creation, fetch the contact to return it
		// Use the phone number lookup endpoint
		const createdContact = await searchContacts(phoneNumber);
		if (createdContact.length > 0) {
			return createdContact[0]!;
		}

		// If we can't fetch it, return a minimal contact object
		return {
			id: phoneNumber, // Fallback ID
			phone_number: phoneNumber,
			first_name: contact.first_name,
			last_name: contact.last_name,
			email: contact.email,
		} as import("./types").AlowareContact;
	} catch (error) {
		console.error("[aloware] Error creating contact:", error);
		throw error;
	}
}

/**
 * Update a contact
 * Uses Aloware's webhook API: POST /api/v1/webhook/forms with force_update=true
 * API token must be in the body, not query params
 * 
 * @param contactId - Contact ID (not used, but kept for compatibility)
 * @param updates - Contact updates, must include phone_number
 */
export async function updateContact(
	contactId: string,
	updates: Partial<import("./types").AlowareContact>
): Promise<import("./types").AlowareContact> {
	try {
		const apiToken = env.ALOWARE_API_TOKEN;
		if (!apiToken) {
			throw new Error("ALOWARE_API_TOKEN is not configured");
		}

		// Phone number is required for Aloware API
		const phoneNumber = updates.phone_number;
		if (!phoneNumber) {
			throw new Error("phone_number is required for Aloware contact update. Cannot look up contact by ID.");
		}

		// Normalize phone number
		const normalizedPhone = phoneNumber.replace(/[^\d+]/g, "");

		// Build payload according to Aloware API spec
		const payload: Record<string, unknown> = {
			api_token: apiToken, // Required: token goes in body
			phone_number: normalizedPhone, // Required
			force_update: true, // Update mode
		};

		// Map our contact fields to Aloware API fields
		if (updates.first_name !== undefined) payload.first_name = updates.first_name;
		if (updates.last_name !== undefined) payload.last_name = updates.last_name;
		if (updates.name !== undefined) payload.name = updates.name;
		if (updates.email !== undefined) payload.email = updates.email;
		if (updates.timezone !== undefined) payload.timezone = updates.timezone;
		if (updates.country !== undefined) payload.country = updates.country;
		if (updates.state !== undefined) payload.state = updates.state;
		if (updates.city !== undefined) payload.city = updates.city;
		if (updates.lead_source !== undefined) payload.lead_source = updates.lead_source;

		const response = await alowareRequest<{ message: string }>(
			"/webhook/forms",
			{
				method: "POST",
				body: JSON.stringify(payload),
			}
		);

		// After update, fetch the contact to return it
		const updatedContact = await searchContacts(normalizedPhone);
		if (updatedContact.length > 0) {
			return updatedContact[0]!;
		}

		// Return existing contact with updates applied
		return { ...existingContact, ...updates } as import("./types").AlowareContact;
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
 * NOTE: Aloware API may not support PUT for call lists.
 * This function attempts to update, but may fail if the API doesn't support it.
 */
export async function updateCallList(
	listId: string,
	updates: { name?: string; description?: string; contact_ids?: string[] }
): Promise<import("./types").AlowareCallList> {
	try {
		const apiToken = env.ALOWARE_API_TOKEN;
		if (!apiToken) {
			throw new Error("ALOWARE_API_TOKEN is not configured");
		}

		// Include API token in body for PUT requests (if required)
		const payload = {
			...updates,
			api_token: apiToken,
		};

		const data = await alowareRequest<import("./types").AlowareCallList>(
			`/call-lists/${listId}`,
			{
				method: "PUT",
				body: JSON.stringify(payload),
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

