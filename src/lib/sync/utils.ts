import { createHash } from "crypto";

/**
 * Compute dedupe key for webhook events
 */
export function computeDedupeKey(
	source: string,
	eventType: string,
	entityId: string,
	payload: unknown
): string {
	const payloadHash = createHash("sha256")
		.update(JSON.stringify(payload))
		.digest("hex")
		.substring(0, 16);

	return `${source}:${eventType}:${entityId}:${payloadHash}`;
}

/**
 * Extract event type from webhook payload
 */
export function extractEventType(body: unknown): string | null {
	if (typeof body !== "object" || body === null) {
		return null;
	}
	
	const obj = body as Record<string, unknown>;
	
	if ("event" in obj && typeof obj.event === "string") {
		return obj.event;
	}
	if ("type" in obj && typeof obj.type === "string") {
		return obj.type;
	}
	if ("eventType" in obj && typeof obj.eventType === "string") {
		return obj.eventType;
	}
	
	return null;
}

/**
 * Extract entity ID from payload
 */
export function extractEntityId(body: unknown): string | null {
	if (typeof body !== "object" || body === null) {
		return null;
	}
	
	const obj = body as Record<string, unknown>;
	
	// Try common ID fields
	if ("id" in obj && typeof obj.id === "string") {
		return obj.id;
	}
	if ("contactId" in obj && typeof obj.contactId === "string") {
		return obj.contactId;
	}
	if ("contact_id" in obj && typeof obj.contact_id === "string") {
		return obj.contact_id;
	}
	if ("communication_id" in obj && typeof obj.communication_id === "string") {
		return obj.communication_id;
	}
	
	// Check nested objects
	if ("contact" in obj && typeof obj.contact === "object" && obj.contact !== null) {
		const contact = obj.contact as Record<string, unknown>;
		if (contact.id && typeof contact.id === "string") {
			return contact.id;
		}
	}
	
	if ("body" in obj && typeof obj.body === "object" && obj.body !== null) {
		const bodyObj = obj.body as Record<string, unknown>;
		if (bodyObj.id && typeof bodyObj.id === "string") {
			return bodyObj.id;
		}
		if (bodyObj.contact_id && typeof bodyObj.contact_id === "string") {
			return bodyObj.contact_id;
		}
		if (bodyObj.communication_id && typeof bodyObj.communication_id === "string") {
			return bodyObj.communication_id;
		}
	}
	
	return null;
}

