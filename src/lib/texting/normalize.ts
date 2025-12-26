import type { TextingWebhookPayload, TextingEventType, TextingDirection } from "./types";

/**
 * Normalize raw texting webhook payload to standard format
 * Handles various provider formats generically
 */
export function normalizeTextingWebhook(raw: unknown): TextingWebhookPayload {
	if (typeof raw !== "object" || raw === null) {
		return {
			eventType: "unknown",
			raw,
		};
	}

	const obj = raw as Record<string, unknown>;

	// Extract event type
	let eventType: TextingEventType = "unknown";
	if (typeof obj.type === "string") {
		eventType = obj.type as TextingEventType;
	} else if (typeof obj.eventType === "string") {
		eventType = obj.eventType as TextingEventType;
	} else if (typeof obj.event === "string") {
		eventType = obj.event as TextingEventType;
	}

	// Extract message/conversation data (handle nested structures)
	let messageData: Record<string, unknown> = {};
	if (obj.message && typeof obj.message === "object" && obj.message !== null) {
		messageData = obj.message as Record<string, unknown>;
	} else if (obj.data && typeof obj.data === "object" && obj.data !== null) {
		messageData = obj.data as Record<string, unknown>;
	} else {
		// Use root object as message data
		messageData = obj;
	}

	// Extract fields
	const messageId = extractString(messageData.id) || extractString(messageData.messageId) || extractString(obj.messageId);
	const conversationId = extractString(messageData.conversationId) || extractString(obj.conversationId);
	const direction = extractDirection(messageData.direction) || extractDirection(obj.direction);
	const from = extractString(messageData.from) || extractString(obj.from);
	const to = extractString(messageData.to) || extractString(obj.to);
	const body = extractString(messageData.body) || extractString(messageData.text) || extractString(messageData.message) || extractString(obj.body);
	const timestamp = extractString(messageData.timestamp) || extractString(messageData.createdAt) || extractString(messageData.date) || extractString(obj.timestamp);
	const status = extractStatus(messageData.status) || extractStatus(obj.status);
	const errorCode = extractString(messageData.errorCode) || extractString(obj.errorCode);
	const errorMessage = extractString(messageData.errorMessage) || extractString(messageData.error) || extractString(obj.errorMessage);

	return {
		eventType,
		messageId,
		conversationId,
		direction,
		from,
		to,
		body,
		timestamp,
		status,
		errorCode,
		errorMessage,
		raw,
	};
}

/**
 * Extract string value safely
 */
function extractString(value: unknown): string | undefined {
	if (typeof value === "string" && value) {
		return value;
	}
	return undefined;
}

/**
 * Extract direction value safely
 */
function extractDirection(value: unknown): TextingDirection | undefined {
	if (value === "inbound" || value === "outbound") {
		return value;
	}
	if (typeof value === "string") {
		const lower = value.toLowerCase();
		if (lower.includes("inbound") || lower.includes("incoming")) {
			return "inbound";
		}
		if (lower.includes("outbound") || lower.includes("outgoing")) {
			return "outbound";
		}
	}
	return undefined;
}

/**
 * Extract status value safely
 */
function extractStatus(value: unknown): TextingWebhookPayload["status"] | undefined {
	if (
		value === "queued" ||
		value === "sent" ||
		value === "delivered" ||
		value === "failed" ||
		value === "received"
	) {
		return value;
	}
	return undefined;
}

