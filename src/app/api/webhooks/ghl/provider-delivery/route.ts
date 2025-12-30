import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { sendMessage } from "@/lib/texting/client";
import { db } from "@/server/db";
import { messageMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Handle GHL Provider Delivery Webhooks
 * 
 * This endpoint receives webhooks from GHL when:
 * - An agent sends a message through our provider
 * - Message delivery status updates occur
 * 
 * Flow: GHL → This endpoint → Verity → Telnyx
 */
export async function POST(req: NextRequest) {
	console.log("[ghl.provider-delivery] Received provider delivery webhook");

	try {
		const body = await req.json();
		console.log("[ghl.provider-delivery] Webhook payload:", JSON.stringify(body, null, 2));

		// GHL provider webhooks typically include:
		// - messageId: GHL's message ID
		// - conversationId: GHL conversation ID
		// - contactId: GHL contact ID
		// - phone: Phone number
		// - message: Message body
		// - direction: "outbound" (since it's from GHL)
		// - status: Message status (if status update)
		// - type: "sms" or message type

		const messageId = body.messageId || body.id || body.message?.id;
		const conversationId = body.conversationId || body.conversation?.id;
		const contactId = body.contactId || body.contact?.id;
		const phone = body.phone || body.phoneNumber || body.to;
		const messageBody = body.message || body.body || body.text;
		const direction = body.direction || "outbound";
		const status = body.status || body.messageStatus;
		const eventType = body.type || body.eventType || "message.sent";

		// If this is a status update (not a new message), handle it differently
		if (status && eventType !== "message.sent" && eventType !== "message.outbound") {
			console.log(`[ghl.provider-delivery] Status update for message ${messageId}: ${status}`);
			// TODO: Update message status in GHL if needed
			// For now, just acknowledge
			return NextResponse.json({ success: true, message: "Status update received" });
		}

		// Validate required fields for sending a message
		if (!phone || !messageBody) {
			console.warn("[ghl.provider-delivery] Missing required fields:", { phone, messageBody });
			return NextResponse.json(
				{ error: "Missing required fields: phone and message" },
				{ status: 400 }
			);
		}

		// Only process outbound messages (from GHL to customer)
		if (direction !== "outbound") {
			console.log(`[ghl.provider-delivery] Ignoring non-outbound message: ${direction}`);
			return NextResponse.json({ success: true, message: "Ignored non-outbound message" });
		}

		console.log(`[ghl.provider-delivery] Processing outbound message to ${phone}`);

		// Send message via Verity
		let verityMessageId: string;
		try {
			const result = await sendMessage({
				to: phone,
				body: messageBody,
				conversationId: conversationId || undefined,
				correlationId: messageId || undefined,
			});
			verityMessageId = result.messageId;
			console.log(`[ghl.provider-delivery] Message sent via Verity: ${verityMessageId}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`[ghl.provider-delivery] Error sending message via Verity:`, errorMessage);
			
			// Return error to GHL so it can handle it appropriately
			return NextResponse.json(
				{ 
					success: false, 
					error: errorMessage,
					messageId: messageId || null,
				},
				{ status: 500 }
			);
		}

		// Store mapping between GHL message and Verity message
		if (messageId && verityMessageId) {
			try {
				await db.insert(messageMappings).values({
					textingMessageId: verityMessageId,
					ghlMessageId: messageId,
					ghlContactId: contactId || null,
					conversationId: conversationId || null,
					fromNumber: null, // We'll need to determine the "from" number
					toNumber: phone,
					direction: "outbound",
				}).onConflictDoNothing();
			} catch (mappingError) {
				// Log but don't fail - mapping is for tracking, not critical
				console.error("[ghl.provider-delivery] Error storing message mapping:", mappingError);
			}
		}

		// Return success to GHL
		return NextResponse.json({
			success: true,
			messageId: verityMessageId,
			ghlMessageId: messageId,
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("[ghl.provider-delivery] Error processing webhook:", errorMessage);
		
		// Return error to GHL
		return NextResponse.json(
			{ success: false, error: errorMessage },
			{ status: 500 }
		);
	}
}

