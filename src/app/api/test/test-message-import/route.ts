import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { addInboundMessage } from "@/lib/ghl/conversations";

export const dynamic = "force-dynamic";

/**
 * Test Message Import
 * 
 * Tests importing a message directly without creating a conversation first.
 * This will help us see if the "Incorrect conversationProviderId/type" error
 * is related to conversation creation or the message import itself.
 * 
 * POST /api/test/test-message-import
 * Body: { contactId, phone, message }
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const contactId = body.contactId?.trim();
		const phone = body.phone?.trim();
		const message = body.message?.trim() || "Test message import";

		if (!contactId) {
			return NextResponse.json({
				error: "contactId is required",
				example: { contactId: "A94aNbVMezt0w4N4rVE5", phone: "+19192715870", message: "Test" },
			}, { status: 400 });
		}

		if (!phone) {
			return NextResponse.json({
				error: "phone is required",
			}, { status: 400 });
		}

		const conversationProviderId = env.GHL_CONVERSATION_PROVIDER_ID?.trim();
		if (!conversationProviderId) {
			return NextResponse.json({
				error: "GHL_CONVERSATION_PROVIDER_ID is not configured",
			}, { status: 500 });
		}

		console.log("[test-message-import] Attempting to import message:", {
			contactId,
			phone,
			conversationProviderId,
			messageLength: message.length,
		});

		// Try importing WITHOUT creating conversation first
		// Pass null for conversationId to let GHL auto-create
		const ghlMessageId = await addInboundMessage(contactId, message, {
			phoneNumber: phone,
			conversationId: undefined, // Explicitly don't create conversation first
			conversationProviderId,
			date: new Date(),
		});

		return NextResponse.json({
			success: true,
			message: "Message imported successfully",
			ghlMessageId,
			configuration: {
				contactId,
				phone,
				conversationProviderId,
			},
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorUrl = (error as { url?: string })?.url || "unknown";
		
		console.error("[test-message-import] Error:", errorMessage);
		
		return NextResponse.json({
			success: false,
			error: errorMessage,
			url: errorUrl,
			details: {
				// Check if it's the provider validation error
				isProviderError: errorMessage.includes("Incorrect conversationProviderId") || 
				                 errorMessage.includes("conversationProviderId"),
				// Check if it's a type error
				isTypeError: errorMessage.includes("type"),
			},
		}, { status: 500 });
	}
}

