import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { getGhlAccessToken } from "@/lib/ghl/oauth-tokens";
import { ghlRequest } from "@/lib/ghl/client";

export const dynamic = "force-dynamic";

/**
 * Test Live Message with Provider
 * 
 * Tests sending a live message using the conversation provider.
 * This uses POST /conversations/messages (live endpoint) instead of import endpoints.
 * 
 * POST /api/test/test-live-message
 * Body: { contactId, phone, message }
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const contactId = body.contactId?.trim();
		const phone = body.phone?.trim();
		const message = body.message?.trim() || "Test live message";

		if (!contactId || !phone) {
			return NextResponse.json({
				error: "contactId and phone are required",
				example: { contactId: "A94aNbVMezt0w4N4rVE5", phone: "+19192715870", message: "Test" },
			}, { status: 400 });
		}

		const locationId = env.GHL_LOCATION_ID?.trim();
		const conversationProviderId = env.GHL_CONVERSATION_PROVIDER_ID?.trim();

		if (!locationId || !conversationProviderId) {
			return NextResponse.json({
				error: "GHL_LOCATION_ID and GHL_CONVERSATION_PROVIDER_ID must be configured",
			}, { status: 500 });
		}

		// Get OAuth token
		const oauthToken = await getGhlAccessToken(locationId);

		console.log("[test-live-message] Testing live message endpoint with provider:", {
			locationId,
			contactId,
			conversationProviderId,
			hasToken: !!oauthToken,
		});

		// Try the LIVE message endpoint (not import)
		// This is POST /conversations/messages with type and conversationProviderId
		const liveMessageBody = {
			locationId,
			contactId,
			conversationProviderId,
			type: "SMS", // MCP confirms this works for live messages
			message,
			phone,
		};

		console.log("[test-live-message] Request body:", JSON.stringify(liveMessageBody, null, 2));

		try {
			const response = await ghlRequest<{ message?: { id: string }; id?: string; data?: { id: string } }>(
				"/conversations/messages",
				{
					method: "POST",
					body: JSON.stringify(liveMessageBody),
				},
				true // useOAuth
			);

			const messageId = response.message?.id || response.id || response.data?.id;

			return NextResponse.json({
				success: true,
				message: "Live message sent successfully!",
				messageId,
				endpoint: "POST /conversations/messages (live endpoint)",
				payload: liveMessageBody,
				note: "This confirms the provider ID and type work for LIVE messages. Import endpoints may have different requirements.",
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorUrl = (error as { url?: string })?.url || "unknown";

			return NextResponse.json({
				success: false,
				error: errorMessage,
				url: errorUrl,
				endpoint: "POST /conversations/messages (live endpoint)",
				payload: liveMessageBody,
				details: {
					isProviderError: errorMessage.includes("conversationProviderId") || errorMessage.includes("provider"),
					isTypeError: errorMessage.includes("type"),
				},
			}, { status: 500 });
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return NextResponse.json({
			success: false,
			error: errorMessage,
		}, { status: 500 });
	}
}




