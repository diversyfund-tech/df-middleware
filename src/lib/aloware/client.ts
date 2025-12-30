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

		// If we can't fetch it, return updates as a minimal contact object
		return {
			id: contactId, // Fallback ID
			phone_number: normalizedPhone,
			...updates,
		} as import("./types").AlowareContact;
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
 * Add contacts to a Power Dialer list
 * NOTE: Aloware API doesn't support direct add via PUT.
 * This function attempts to use the webhook endpoint if available,
 * otherwise it will need to use CSV import (not implemented here).
 * 
 * For now, this is a placeholder that throws an error indicating CSV import is required.
 */
export async function addContactsToList(
	listId: string,
	contactIds: string[]
): Promise<{ message: string }> {
	const apiToken = env.ALOWARE_API_TOKEN;
	if (!apiToken) {
		throw new Error("ALOWARE_API_TOKEN is not configured");
	}

	// Try the webhook endpoint pattern (if it exists)
	// Based on the pattern: /webhook/powerdialer-remove-contact-from-lists
	// There might be: /webhook/powerdialer-add-contact-to-lists
	try {
		const payload = {
			api_token: apiToken,
			list_id: listId,
			contact_ids: contactIds, // Array of contact IDs
		};

		const response = await fetch(`${ALOWARE_API_BASE_URL}/webhook/powerdialer-add-contact-to-lists`, {
			method: "POST",
			headers: {
				"Accept": "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			// If 404, the endpoint doesn't exist - fall through to CSV import requirement
			if (response.status === 404) {
				throw new Error(
					`Aloware API does not support programmatic addition of contacts to lists. ` +
					`Please use CSV import to add contacts to list ${listId}. ` +
					`Contact IDs to add: ${contactIds.join(", ")}`
				);
			}
			throw new Error(`Aloware API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
		}

		return await response.json() as { message: string };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		// If it's a 404 or the endpoint doesn't exist, provide helpful error
		if (errorMessage.includes("404") || errorMessage.includes("does not support")) {
			throw new Error(
				`Aloware API does not support programmatic addition of contacts to Power Dialer lists. ` +
				`Please use CSV import in Aloware to add the following contact IDs to list ${listId}: ` +
				contactIds.join(", ")
			);
		}
		console.error("[aloware] Error adding contacts to list:", error);
		throw error;
	}
}

/**
 * Remove a contact from all Power Dialer lists
 * Uses: POST /api/v1/webhook/powerdialer-remove-contact-from-lists
 */
export async function removeContactFromAllLists(
	contactId: string
): Promise<{ message: string }> {
	const apiToken = env.ALOWARE_API_TOKEN;
	if (!apiToken) {
		throw new Error("ALOWARE_API_TOKEN is not configured");
	}

	const payload = {
		api_token: apiToken,
		contact_id: contactId,
	};

	const response = await fetch(`${ALOWARE_API_BASE_URL}/webhook/powerdialer-remove-contact-from-lists`, {
		method: "POST",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		console.error(`[aloware] API request failed: ${ALOWARE_API_BASE_URL}/webhook/powerdialer-remove-contact-from-lists`);
		console.error(`[aloware] Response status: ${response.status} ${response.statusText}`);
		console.error(`[aloware] Response body: ${errorText.substring(0, 500)}`);
		throw new Error(
			`Aloware API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`,
		);
	}

	return await response.json() as { message: string };
}

/**
 * Remove contacts from a specific call list
 * NOTE: Aloware doesn't have a direct endpoint for this.
 * We can remove from all lists, then re-add to the lists we want to keep.
 * For now, this uses removeContactFromAllLists as a workaround.
 */
export async function removeContactsFromList(
	listId: string,
	contactIds: string[]
): Promise<{ message: string }> {
	// Aloware doesn't have a direct "remove from specific list" endpoint
	// We can only remove from all lists
	// For now, remove from all lists (this is a limitation)
	const results = [];
	for (const contactId of contactIds) {
		try {
			const result = await removeContactFromAllLists(contactId);
			results.push({ contactId, result });
		} catch (error) {
			console.error(`[aloware] Error removing contact ${contactId} from all lists:`, error);
			// Continue with other contacts
		}
	}
	return { message: `Removed ${results.length} contact(s) from all Power Dialer lists` };
}

/**
 * Clear all contacts from a Power Dialer list
 * Uses: POST /api/v1/webhook/powerdialer-clear-list
 */
export async function clearCallList(
	listId: string
): Promise<{ message: string }> {
	const apiToken = env.ALOWARE_API_TOKEN;
	if (!apiToken) {
		throw new Error("ALOWARE_API_TOKEN is not configured");
	}

	const payload = {
		api_token: apiToken,
		list_id: listId,
	};

	const response = await fetch(`${ALOWARE_API_BASE_URL}/webhook/powerdialer-clear-list`, {
		method: "POST",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		console.error(`[aloware] API request failed: ${ALOWARE_API_BASE_URL}/webhook/powerdialer-clear-list`);
		console.error(`[aloware] Response status: ${response.status} ${response.statusText}`);
		console.error(`[aloware] Response body: ${errorText.substring(0, 500)}`);
		throw new Error(
			`Aloware API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`,
		);
	}

	return await response.json() as { message: string };
}

/**
 * Enroll a contact in an Aloware sequence
 * Uses: POST /api/v1/webhook/sequence-enroll
 */
export async function enrollContactInSequence(
	phoneNumber: string,
	sequenceId: string,
	forceEnroll: boolean = true
): Promise<{ message: string }> {
	const apiToken = env.ALOWARE_API_TOKEN;
	if (!apiToken) {
		throw new Error("ALOWARE_API_TOKEN is not configured");
	}

	// Normalize phone number (remove non-digits, keep + if present)
	const normalizedPhone = phoneNumber.replace(/[^\d+]/g, "");

	const payload = {
		api_token: apiToken,
		sequence_id: sequenceId,
		force_enroll: forceEnroll,
		source: "phone_number",
		phone_number: normalizedPhone,
	};

	const response = await fetch(`${ALOWARE_API_BASE_URL}/webhook/sequence-enroll`, {
		method: "POST",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		console.error(`[aloware] API request failed: ${ALOWARE_API_BASE_URL}/webhook/sequence-enroll`);
		console.error(`[aloware] Response status: ${response.status} ${response.statusText}`);
		console.error(`[aloware] Response body: ${errorText.substring(0, 500)}`);
		throw new Error(
			`Aloware API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`,
		);
	}

	return await response.json() as { message: string };
}

/**
 * Disenroll a contact from all Aloware sequences
 * Uses: POST /api/v1/webhook/sequence-disenroll
 * Safe to call even if not enrolled (swallows errors)
 */
export async function disenrollContactFromAllSequences(
	phoneNumber: string
): Promise<{ message: string } | null> {
	const apiToken = env.ALOWARE_API_TOKEN;
	if (!apiToken) {
		throw new Error("ALOWARE_API_TOKEN is not configured");
	}

	// Normalize phone number (remove non-digits, keep + if present)
	const normalizedPhone = phoneNumber.replace(/[^\d+]/g, "");

	const payload = {
		api_token: apiToken,
		source: "phone_number",
		phone_number: normalizedPhone,
	};

	try {
		const response = await fetch(`${ALOWARE_API_BASE_URL}/webhook/sequence-disenroll`, {
			method: "POST",
			headers: {
				"Accept": "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			// Swallow errors - safe to call even if not enrolled
			console.warn(`[aloware] Sequence disenroll returned ${response.status}: ${errorText.substring(0, 200)}`);
			return null;
		}

		return await response.json() as { message: string };
	} catch (error) {
		// Swallow errors - safe operation
		console.warn(`[aloware] Error disenrolling from sequences (swallowed):`, error);
		return null;
	}
}

/**
 * Get contact ID by phone number (helper for Power Dialer list removal)
 * Uses: GET /api/v1/webhook/contact/phone-number
 */
export async function getContactIdByPhone(phoneNumber: string): Promise<string | null> {
	try {
		const contacts = await searchContacts(phoneNumber);
		return contacts.length > 0 ? contacts[0]!.id : null;
	} catch (error) {
		console.error(`[aloware] Error getting contact ID by phone:`, error);
		return null;
	}
}

/**
 * Get all sequences
 * Uses: GET /api/v1/sequences (or similar endpoint - may need to verify with Aloware docs)
 * NOTE: This endpoint may not exist - check Aloware API documentation
 */
export async function getSequences(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
	try {
		const data = await alowareRequest<{ data?: Array<{ id: string; name: string; [key: string]: unknown }>; sequences?: Array<{ id: string; name: string; [key: string]: unknown }> }>(
			"/sequences"
		);

		if (data.data) return data.data;
		if (data.sequences) return data.sequences;
		return [];
	} catch (error) {
		console.error("[aloware] Error fetching sequences:", error);
		// If endpoint doesn't exist, return empty array
		return [];
	}
}

/**
 * Create a sequence
 * Uses: POST /api/v1/sequences (or similar endpoint - may need to verify with Aloware docs)
 * NOTE: This endpoint may not exist - sequences may need to be created manually in Aloware
 */
export async function createSequence(
	sequence: { name: string; description?: string; [key: string]: unknown }
): Promise<{ id: string; name: string; [key: string]: unknown }> {
	const apiToken = env.ALOWARE_API_TOKEN;
	if (!apiToken) {
		throw new Error("ALOWARE_API_TOKEN is not configured");
	}

	const payload = {
		...sequence,
		api_token: apiToken,
	};

	const response = await fetch(`${ALOWARE_API_BASE_URL}/sequences`, {
		method: "POST",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		console.error(`[aloware] API request failed: ${ALOWARE_API_BASE_URL}/sequences`);
		console.error(`[aloware] Response status: ${response.status} ${response.statusText}`);
		console.error(`[aloware] Response body: ${errorText.substring(0, 500)}`);
		throw new Error(
			`Aloware API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`,
		);
	}

	return await response.json() as { id: string; name: string; [key: string]: unknown };
}

