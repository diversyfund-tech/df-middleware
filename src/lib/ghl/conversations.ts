import { env } from "@/env";
import { ghlRequest } from "./client";

/**
 * GHL Conversation Types
 */
export interface GHLConversation {
	id: string;
	contactId: string;
	phoneNumber?: string;
	email?: string;
	type: "sms" | "email" | "chat" | "voice";
	status?: string;
	unreadCount?: number;
	[key: string]: unknown;
}

export interface GHLMessage {
	id: string;
	conversationId: string;
	contactId: string;
	userId?: string;
	message: string;
	direction: "inbound" | "outbound";
	status?: "sent" | "delivered" | "read" | "failed";
	mediaUrl?: string;
	createdAt?: string;
	[key: string]: unknown;
}

/**
 * Create or get a conversation for a contact with a specific provider
 * GHL API: POST /conversations
 * 
 * GHL enforces one conversation per contact per provider, so we can reuse existing conversations.
 * Required: conversationProviderId (from Marketplace App provider)
 */
export async function getOrCreateConversation(
	contactId: string,
	phoneNumber?: string,
	conversationProviderId?: string
): Promise<string> {
	const locationId = env.GHL_LOCATION_ID;
	if (!locationId) {
		throw new Error("GHL_LOCATION_ID is not configured");
	}

	// Use configured provider ID or the one passed in
	const providerId: string | undefined = conversationProviderId?.trim() ?? env.GHL_CONVERSATION_PROVIDER_ID?.trim();
	if (!providerId) {
		throw new Error("GHL_CONVERSATION_PROVIDER_ID is required. Create a Marketplace App with a custom SMS provider first.");
	}

	try {
		// First, try to find existing conversation for this contact + provider
		try {
			const searchResponse = await ghlRequest<{ conversations?: GHLConversation[]; data?: GHLConversation[] }>(
				`/conversations?contactId=${contactId}&conversationProviderId=${providerId}`
			);
			
			const conversations = searchResponse.conversations || searchResponse.data || [];
			if (conversations.length > 0) {
				console.log(`[GHL] Found existing conversation: ${conversations[0].id}`);
				return conversations[0].id;
			}
		} catch (error) {
			console.log("[GHL] Search for existing conversation failed, will create new one:", error instanceof Error ? error.message : String(error));
		}

		// Create new conversation with provider
		const createBody: Record<string, unknown> = {
			locationId,
			contactId,
			conversationProviderId: providerId,
		};

		if (phoneNumber) {
			createBody.phoneNumber = phoneNumber;
		}

		// Use OAuth token for provider-related calls
		const createResponse = await ghlRequest<{ conversation?: GHLConversation; id?: string; data?: GHLConversation }>(
			"/conversations",
			{
				method: "POST",
				body: JSON.stringify(createBody),
			},
			true // useOAuth = true for provider-related calls
		);

		if (createResponse?.conversation?.id) {
			console.log(`[GHL] Created new conversation: ${createResponse.conversation.id}`);
			return createResponse.conversation.id;
		}
		if (createResponse?.id) {
			console.log(`[GHL] Created new conversation: ${createResponse.id}`);
			return createResponse.id;
		}
		if (createResponse?.data?.id) {
			console.log(`[GHL] Created new conversation: ${createResponse.data.id}`);
			return createResponse.data.id;
		}

		throw new Error("Invalid response structure from GHL API when creating conversation");
	} catch (error) {
		console.error("[GHL] Error getting/creating conversation:", error);
		throw error;
	}
}

/**
 * Add an inbound message to GHL (historical import)
 * GHL API: POST /conversations/messages/inbound
 * 
 * This endpoint is for importing historical messages, NOT for sending live SMS.
 * Requires: conversationProviderId (from Marketplace App provider)
 * 
 * Docs: https://marketplace.gohighlevel.com/docs/ghl/conversations/messages
 */
export async function addInboundMessage(
	contactId: string,
	message: string,
	options?: {
		conversationId?: string;
		phoneNumber?: string;
		mediaUrl?: string;
		userId?: string;
		date?: string | Date; // ISO timestamp for historical messages
		conversationProviderId?: string;
	}
): Promise<string> {
	const locationId = env.GHL_LOCATION_ID;
	if (!locationId) {
		throw new Error("GHL_LOCATION_ID is not configured");
	}

	// Get conversationProviderId from options or env
	const conversationProviderId: string | undefined = options?.conversationProviderId?.trim() ?? env.GHL_CONVERSATION_PROVIDER_ID?.trim();
	if (!conversationProviderId) {
		throw new Error("GHL_CONVERSATION_PROVIDER_ID is required. Create a Marketplace App with a custom SMS provider first.");
	}

	try {
		// Create/get conversation first - this ensures the provider is properly linked
		let conversationId = options?.conversationId;
		if (!conversationId) {
			try {
				conversationId = await getOrCreateConversation(contactId, options?.phoneNumber, conversationProviderId);
			} catch (error) {
				console.log("[GHL] Conversation creation failed, will try without conversationId:", error instanceof Error ? error.message : String(error));
				// Continue without conversationId - GHL may auto-create
			}
		}

		const endpoint = "/conversations/messages/inbound";
		const body: Record<string, unknown> = {
			locationId,
			contactId,
			conversationProviderId,
			message,
			type: "SMS", // Required - must match provider type exactly
		};

		// conversationId is optional - GHL will auto-create conversation if not provided
		if (conversationId) {
			body.conversationId = conversationId;
		}

		// Phone number (customer's number - the "from" number for inbound)
		if (options?.phoneNumber) {
			body.phone = options.phoneNumber;
		}

		// Date/timestamp for historical messages (use dateSent as per GHL API)
		if (options?.date) {
			const dateValue = options.date instanceof Date 
				? options.date.toISOString() 
				: options.date;
			body.dateSent = dateValue;
		} else {
			// Default to current time if not provided
			body.dateSent = new Date().toISOString();
		}

		if (options?.mediaUrl) {
			body.mediaUrl = options.mediaUrl;
		}

		if (options?.userId) {
			body.userId = options.userId;
		}

		// Log the request for debugging
		const fullUrl = `https://services.leadconnectorhq.com${endpoint}`;
		console.log(`[GHL] Calling ${fullUrl} with payload:`, JSON.stringify(body, null, 2));

		// Use OAuth token for Marketplace App provider calls
		const response = await ghlRequest<{ message?: GHLMessage; id?: string; data?: GHLMessage }>(
			endpoint,
			{
				method: "POST",
				body: JSON.stringify(body),
			},
			true // useOAuth = true for provider-related calls
		);

		console.log(`[GHL] Response from ${fullUrl}:`, JSON.stringify(response, null, 2));

		if (response.message?.id) {
			return response.message.id;
		}
		if (response.id) {
			return response.id;
		}
		if (response.data?.id) {
			return response.data.id;
		}

		throw new Error("Invalid response structure from GHL API when adding inbound message");
	} catch (error) {
		console.error("[GHL] Error adding inbound message:", error);
		throw error;
	}
}

/**
 * Add an outbound message to GHL (historical import)
 * GHL API: POST /conversations/messages/outbound
 * 
 * This endpoint is for importing historical messages, NOT for sending live SMS.
 * Requires: conversationProviderId (from Marketplace App provider)
 * 
 * Docs: https://marketplace.gohighlevel.com/docs/ghl/conversations/messages
 */
export async function sendOutboundMessage(
	contactId: string,
	message: string,
	options?: {
		conversationId?: string;
		phoneNumber?: string;
		mediaUrl?: string;
		userId?: string;
		date?: string | Date; // ISO timestamp for historical messages
		conversationProviderId?: string;
	}
): Promise<string> {
	const locationId = env.GHL_LOCATION_ID;
	if (!locationId) {
		throw new Error("GHL_LOCATION_ID is not configured");
	}

	// Get conversationProviderId from options or env
	const conversationProviderId: string | undefined = options?.conversationProviderId?.trim() ?? env.GHL_CONVERSATION_PROVIDER_ID?.trim();
	if (!conversationProviderId) {
		throw new Error("GHL_CONVERSATION_PROVIDER_ID is required. Create a Marketplace App with a custom SMS provider first.");
	}

	try {
		// Create/get conversation first - this ensures the provider is properly linked
		let conversationId = options?.conversationId;
		if (!conversationId) {
			try {
				conversationId = await getOrCreateConversation(contactId, options?.phoneNumber, conversationProviderId);
			} catch (error) {
				console.log("[GHL] Conversation creation failed, will try without conversationId:", error instanceof Error ? error.message : String(error));
				// Continue without conversationId - GHL may auto-create
			}
		}

		const endpoint = "/conversations/messages/outbound";
		const body: Record<string, unknown> = {
			locationId,
			contactId,
			conversationProviderId,
			message,
			type: "SMS", // Required - must match provider type exactly
		};

		// conversationId is optional - GHL will auto-create conversation if not provided
		if (conversationId) {
			body.conversationId = conversationId;
		}

		// Phone number (destination number - customer's number for outbound)
		if (options?.phoneNumber) {
			body.phone = options.phoneNumber;
		}

		// Date/timestamp for historical messages (use dateSent as per GHL API)
		if (options?.date) {
			const dateValue = options.date instanceof Date 
				? options.date.toISOString() 
				: options.date;
			body.dateSent = dateValue;
		} else {
			// Default to current time if not provided
			body.dateSent = new Date().toISOString();
		}

		if (options?.mediaUrl) {
			body.mediaUrl = options.mediaUrl;
		}

		// UserId is typically required for outbound messages (who sent it)
		if (options?.userId) {
			body.userId = options.userId;
		}

		// Log the request for debugging
		const fullUrl = `https://services.leadconnectorhq.com${endpoint}`;
		console.log(`[GHL] Calling ${fullUrl} with payload:`, JSON.stringify(body, null, 2));

		// Use OAuth token for Marketplace App provider calls
		const response = await ghlRequest<{ message?: GHLMessage; id?: string; data?: GHLMessage }>(
			endpoint,
			{
				method: "POST",
				body: JSON.stringify(body),
			},
			true // useOAuth = true for provider-related calls
		);

		console.log(`[GHL] Response from ${fullUrl}:`, JSON.stringify(response, null, 2));

		if (response.message?.id) {
			return response.message.id;
		}
		if (response.id) {
			return response.id;
		}
		if (response.data?.id) {
			return response.data.id;
		}

		throw new Error("Invalid response structure from GHL API when sending message");
	} catch (error) {
		console.error("[GHL] Error sending outbound message:", error);
		throw error;
	}
}

/**
 * Create a message in a GHL conversation/chat
 * GHL API: Uses addInboundMessage or sendOutboundMessage based on direction
 * This is a convenience wrapper that routes to the correct endpoint
 */
export async function createMessage(
	conversationId: string,
	contactId: string,
	message: string,
	direction: "inbound" | "outbound",
	options?: {
		mediaUrl?: string;
		userId?: string;
		phoneNumber?: string;
		date?: string | Date;
		conversationProviderId?: string;
	}
): Promise<string> {
	if (direction === "inbound") {
		return addInboundMessage(contactId, message, {
			conversationId,
			phoneNumber: options?.phoneNumber,
			mediaUrl: options?.mediaUrl,
			userId: options?.userId,
			date: options?.date,
			conversationProviderId: options?.conversationProviderId,
		});
	} else {
		return sendOutboundMessage(contactId, message, {
			conversationId,
			phoneNumber: options?.phoneNumber,
			mediaUrl: options?.mediaUrl,
			userId: options?.userId,
			date: options?.date,
			conversationProviderId: options?.conversationProviderId,
		});
	}
}

/**
 * Get messages from a conversation
 * GHL API: GET /conversations/{conversationId}/messages
 */
export async function getConversationMessages(conversationId: string): Promise<GHLMessage[]> {
	try {
		const endpoint = `/conversations/${conversationId}/messages`;
		const response = await ghlRequest<{ messages?: GHLMessage[]; data?: GHLMessage[] }>(endpoint);

		return response.messages || response.data || [];
	} catch (error) {
		console.error("[GHL] Error fetching conversation messages:", error);
		return [];
	}
}

