import { env } from "@/env";
import { getGhlAccessToken } from "./oauth-tokens";

const GHL_API_BASE_URL = env.GHL_BASE_URL || "https://services.leadconnectorhq.com";

/**
 * GoHighLevel API Client
 * 
 * Provides functions to interact with GoHighLevel API.
 * Uses Private Integration Token (PIT) for authentication by default.
 * Uses OAuth tokens for Marketplace App provider-related calls.
 */

/**
 * Make authenticated request to GHL API
 * 
 * IMPORTANT: Location scoping is via `locationId` query param, NOT `Location-Id` header
 * 
 * @param endpoint - API endpoint path
 * @param options - Request options
 * @param useOAuth - If true, use OAuth token instead of PIT (required for Marketplace App providers)
 */
export async function ghlRequest<T>(
	endpoint: string,
	options: RequestInit = {},
	useOAuth: boolean = false
): Promise<T> {
	const locationId = env.GHL_LOCATION_ID;
	
	if (!locationId) {
		throw new Error("GHL_LOCATION_ID is not configured");
	}

	// Determine authentication method
	let authToken: string;
	let authMethod: string;
	
	if (useOAuth) {
		authToken = await getGhlAccessToken(locationId);
		authMethod = "OAuth";
	} else {
		const apiKey = env.GHL_API_KEY;
		if (!apiKey) {
			throw new Error("GHL_API_KEY is not configured");
		}
		authToken = apiKey;
		authMethod = "PIT";
	}

	console.log(`[GHL] Using ${authMethod} authentication for ${endpoint}`);

	// Add locationId as query param if endpoint doesn't already have query params
	// EXCEPTIONS:
	// - free-slots endpoint doesn't accept locationId
	// - conversations/messages/inbound and /outbound might not need locationId in query (it's in body)
	// - /conversations POST endpoint has locationId in body, don't add to query
	let url = `${GHL_API_BASE_URL}${endpoint}`;
	if (!endpoint.includes("/free-slots") && 
	    !endpoint.includes("/conversations/messages/inbound") && 
	    !endpoint.includes("/conversations/messages/outbound") &&
	    !(endpoint === "/conversations" && options.method === "POST")) {
		if (!endpoint.includes("?")) {
			url = `${url}?locationId=${locationId}`;
		} else if (!endpoint.includes("locationId=")) {
			url = `${url}&locationId=${locationId}`;
		}
	}

	const response = await fetch(url, {
		...options,
		headers: {
			"Authorization": `Bearer ${authToken}`,
			"Accept": "application/json",
			"Version": "2021-07-28",
			...(options.method === "POST" || options.method === "PUT" ? { "Content-Type": "application/json" } : {}),
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		const fullUrl = response.url || url;
		let errorMessage = `GHL API error (${response.status}): ${errorText}`;
		
		// Try to parse JSON error if available
		try {
			const errorJson = JSON.parse(errorText);
			if (errorJson.message) {
				errorMessage = `GHL API error (${response.status}): ${errorJson.message}`;
			}
			// Log full error details for debugging
			console.error("[GHL] Full API error response:", JSON.stringify(errorJson, null, 2));
			console.error("[GHL] Request URL:", fullUrl);
		} catch {
			// Not JSON, use text as-is
			console.error("[GHL] Full API error response (text):", errorText);
			console.error("[GHL] Request URL:", fullUrl);
		}
		
		// Include URL in error for better debugging
		const enhancedError = new Error(errorMessage);
		(enhancedError as { url?: string }).url = fullUrl;
		throw enhancedError;
	}

	return response.json() as Promise<T>;
}

/**
 * Get a single contact by GHL contact ID
 */
export async function getContact(ghlContactId: string): Promise<import("./types").GHLContact> {
	try {
		const endpoint = `/contacts/${ghlContactId}`;
		const response = await ghlRequest<import("./types").GHLContact | { contact?: import("./types").GHLContact; data?: import("./types").GHLContact }>(endpoint);
		
		// Handle different response structures
		const resp = response as { contact?: import("./types").GHLContact; data?: import("./types").GHLContact; id?: string };
		if (resp.contact) {
			return resp.contact;
		}
		if (resp.data) {
			return resp.data;
		}
		
		// If response is directly a contact object
		if (resp.id) {
			return response as import("./types").GHLContact;
		}
		
		throw new Error("Invalid response structure from GHL API");
	} catch (error) {
		console.error("[GHL] Error fetching contact:", error);
		
		// If 404, contact might not exist
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("404")) {
			throw new Error(`Contact ${ghlContactId} not found`);
		}
		
		throw error;
	}
}

/**
 * Search for a contact by email or phone
 */
export async function searchContact(email?: string, phone?: string): Promise<import("./types").GHLContact | null> {
	if (!email && !phone) {
		return null;
	}

	try {
		const query = email || phone || "";
		const endpoint = `/contacts?query=${encodeURIComponent(query)}`;
		const response = await ghlRequest<{ contacts?: import("./types").GHLContact[] }>(endpoint);

		if (response.contacts && response.contacts.length > 0) {
			return response.contacts[0];
		}
		return null;
	} catch (error) {
		console.error("[GHL] Error searching contact:", error);
		return null;
	}
}

/**
 * Create a contact in GHL
 */
export async function createContact(contact: Partial<import("./types").GHLContact>): Promise<import("./types").GHLContact> {
	const locationId = env.GHL_LOCATION_ID;
	if (!locationId) {
		throw new Error("GHL_LOCATION_ID is not configured");
	}

	try {
		const response = await ghlRequest<{ contact?: import("./types").GHLContact; id?: string; meta?: { contactId?: string } }>(
			"/contacts",
			{
				method: "POST",
				body: JSON.stringify({
					locationId,
					email: contact.email,
					phone: contact.phone,
					firstName: contact.firstName,
					lastName: contact.lastName,
					tags: contact.tags,
					customFields: contact.customFields,
				}),
			}
		);

		// Handle different response structures
		if (response.contact) {
			return response.contact;
		}
		if (response.id) {
			// If we only got an ID, fetch the full contact
			return getContact(response.id);
		}
		if (response.meta?.contactId) {
			return getContact(response.meta.contactId);
		}

		throw new Error("Invalid response structure from GHL API");
	} catch (error) {
		// Handle duplicate contact error - extract contact ID from error response
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("duplicated contacts") || errorMessage.includes("duplicate")) {
			const errorMatch = errorMessage.match(/"contactId":"([^"]+)"/);
			if (errorMatch) {
				return getContact(errorMatch[1]);
			}
			// Try to parse the full error response
			try {
				const errorJson = JSON.parse(errorMessage.split(": ")[1] || "{}");
				if (errorJson.meta?.contactId) {
					return getContact(errorJson.meta.contactId);
				}
			} catch {
				// Ignore parse errors
			}
		}
		throw error;
	}
}

/**
 * Update a contact in GHL
 */
export async function updateContact(
	ghlContactId: string,
	updates: Partial<import("./types").GHLContact>
): Promise<import("./types").GHLContact> {
	const locationId = env.GHL_LOCATION_ID;
	if (!locationId) {
		throw new Error("GHL_LOCATION_ID is not configured");
	}

	try {
		// Remove locationId from updates if present (it's in query param)
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { locationId: _unused, ...updateBody } = updates as Record<string, unknown>;
		
		const response = await ghlRequest<import("./types").GHLContact | { contact?: import("./types").GHLContact; data?: import("./types").GHLContact }>(
			`/contacts/${ghlContactId}`,
			{
				method: "PUT",
				body: JSON.stringify(updateBody),
			}
		);
		
		// Handle different response structures
		const resp = response as { contact?: import("./types").GHLContact; data?: import("./types").GHLContact; id?: string };
		if (resp.contact) {
			return resp.contact;
		}
		if (resp.data) {
			return resp.data;
		}
		
		// If response is directly a contact object
		if (resp.id) {
			return response as import("./types").GHLContact;
		}
		
		throw new Error("Invalid response structure from GHL API");
	} catch (error) {
		console.error("[GHL] Error updating contact:", error);
		throw error;
	}
}

/**
 * Get or create a contact in GHL
 * Searches by email/phone first, creates if not found
 */
export async function getOrCreateContact(
	email?: string,
	phone?: string,
	firstName?: string,
	lastName?: string
): Promise<string> {
	// First, try to find existing contact
	const existing = await searchContact(email, phone);
	if (existing) {
		return existing.id;
	}

	// Create new contact if not found
	const newContact = await createContact({
		email,
		phone,
		firstName,
		lastName,
	});

	return newContact.id;
}

/**
 * Add tags to a GHL contact
 */
export async function addTagsToContact(ghlContactId: string, tags: string[]): Promise<import("./types").GHLContact> {
	const contact = await getContact(ghlContactId);
	const existingTags = contact.tags || [];
	const newTags = [...new Set([...existingTags, ...tags])];
	
	return updateContact(ghlContactId, { tags: newTags });
}

/**
 * Remove tags from a GHL contact
 */
export async function removeTagsFromContact(ghlContactId: string, tags: string[]): Promise<import("./types").GHLContact> {
	const contact = await getContact(ghlContactId);
	const existingTags = contact.tags || [];
	const newTags = existingTags.filter(tag => !tags.includes(tag));
	
	return updateContact(ghlContactId, { tags: newTags });
}

/**
 * Get users/team members from GHL
 * Note: GHL API may use different endpoints - this is a best-effort implementation
 */
export async function getUsers(): Promise<Array<{ id?: string; email?: string; name?: string; [key: string]: unknown }>> {
	try {
		// Try common GHL endpoints for users/team members
		const endpoints = ["/users", "/team-members", "/team"];
		
		for (const endpoint of endpoints) {
			try {
				const response = await ghlRequest<{ users?: unknown[]; teamMembers?: unknown[]; data?: unknown[]; [key: string]: unknown }>(endpoint);
				
				// Handle different response structures
				if (Array.isArray(response)) {
					return response as Array<{ id?: string; email?: string; name?: string; [key: string]: unknown }>;
				}
				if (response.users && Array.isArray(response.users)) {
					return response.users as Array<{ id?: string; email?: string; name?: string; [key: string]: unknown }>;
				}
				if (response.teamMembers && Array.isArray(response.teamMembers)) {
					return response.teamMembers as Array<{ id?: string; email?: string; name?: string; [key: string]: unknown }>;
				}
				if (response.data && Array.isArray(response.data)) {
					return response.data as Array<{ id?: string; email?: string; name?: string; [key: string]: unknown }>;
				}
			} catch {
				// Try next endpoint
				continue;
			}
		}
		
		// If no endpoint worked, return empty array
		console.warn("[GHL] Could not fetch users from any known endpoint");
		return [];
	} catch (error) {
		console.error("[GHL] Error fetching users:", error);
		return [];
	}
}

