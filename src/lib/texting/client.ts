import { env } from "@/env";
import { db } from "@/server/db";
import { optoutRegistry } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { OptedOutError } from "@/lib/compliance/smsOptOut";

const VERITY_API_BASE_URL = env.VERITY_BASE_URL;

/**
 * Texting API Client
 * 
 * Provides functions to interact with Verity (proprietary texting system) API.
 * Verity handles Telnyx integration internally.
 */

/**
 * Check if phone number is opted out
 */
async function checkOptOut(phoneNumber: string): Promise<boolean> {
	const optout = await db.query.optoutRegistry.findFirst({
		where: eq(optoutRegistry.phoneNumber, phoneNumber),
	});

	return optout?.status === "opted_out";
}

/**
 * Make authenticated request to Verity API
 */
async function verityRequest<T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> {
	const apiKey = env.VERITY_API_KEY;

	if (!apiKey) {
		throw new Error("VERITY_API_KEY is not configured");
	}

	if (!VERITY_API_BASE_URL) {
		throw new Error("VERITY_BASE_URL is not configured");
	}

	const url = `${VERITY_API_BASE_URL}${endpoint}`;

	const response = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${apiKey}`,
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(
			`Verity API error: ${response.status} ${response.statusText} - ${errorText}`,
		);
	}

	return response.json() as Promise<T>;
}

/**
 * Send a message via Verity API
 */
export async function sendMessage(params: {
	to: string;
	from?: string;
	body: string;
	conversationId?: string;
	correlationId?: string;
}): Promise<{ messageId: string }> {
	// Check opt-out before sending
	const isOptedOut = await checkOptOut(params.to);
	if (isOptedOut) {
		throw new OptedOutError(`Cannot send message to ${params.to}: number has opted out`);
	}

	try {
		const payload: Record<string, unknown> = {
			to: params.to,
			body: params.body,
		};

		if (params.from) {
			payload.from = params.from;
		}

		if (params.conversationId) {
			payload.conversationId = params.conversationId;
		}

		if (params.correlationId) {
			payload.correlationId = params.correlationId;
		}

		const response = await verityRequest<{ messageId?: string; id?: string; success?: boolean }>(
			"/api/integrations/df-middleware/send-message",
			{
				method: "POST",
				body: JSON.stringify(payload),
			}
		);

		const messageId = response.messageId || response.id;
		if (!messageId) {
			throw new Error("No messageId in response from Verity");
		}

		return { messageId: String(messageId) };
	} catch (error) {
		console.error("[texting] Error sending message via Verity:", error);
		throw error;
	}
}

/**
 * Get a message by ID (not currently supported by Verity API)
 */
export async function getMessage(messageId: string): Promise<unknown | null> {
	console.warn("[texting] getMessage not implemented for Verity API");
	throw new Error("getMessage is not supported by Verity API");
}

/**
 * Get a conversation by ID (not currently supported by Verity API)
 */
export async function getConversation(conversationId: string): Promise<unknown | null> {
	console.warn("[texting] getConversation not implemented for Verity API");
	throw new Error("getConversation is not supported by Verity API");
}

/**
 * Search conversations by phone number (not currently supported by Verity API)
 */
export async function searchConversationByNumber(phone: string): Promise<unknown[]> {
	console.warn("[texting] searchConversationByNumber not implemented for Verity API");
	return [];
}

