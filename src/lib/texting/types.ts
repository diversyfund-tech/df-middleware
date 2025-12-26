/**
 * Texting System Type Definitions
 */

export type TextingDirection = "inbound" | "outbound";

export type TextingEventType =
	| "message.received"
	| "message.sent"
	| "message.delivered"
	| "message.failed"
	| "conversation.created"
	| "optout.stop"
	| "optout.help"
	| "unknown";

export interface TextingWebhookPayload {
	eventType: TextingEventType;
	messageId?: string; // provider message id
	conversationId?: string; // thread id if present
	direction?: TextingDirection;
	from?: string; // E.164
	to?: string; // E.164
	body?: string;
	timestamp?: string; // ISO
	status?: "queued" | "sent" | "delivered" | "failed" | "received";
	errorCode?: string;
	errorMessage?: string;

	// raw passthrough for debugging
	raw: unknown;
}

