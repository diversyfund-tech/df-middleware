import { NextRequest, NextResponse } from "next/server";
import { addInboundMessage } from "@/lib/ghl/conversations";
import { env } from "@/env";

export const dynamic = "force-dynamic";

/**
 * Test GHL Message Import Endpoint
 * 
 * POST /api/test/ghl-import
 * Body: { locationId, contactId, text }
 * 
 * Tests importing an inbound message using OAuth token
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { locationId, contactId, text } = body;

		if (!locationId || !contactId || !text) {
			return NextResponse.json(
				{ error: "Missing required fields: locationId, contactId, text" },
				{ status: 400 }
			);
		}

		// Verify locationId matches configured location
		const configuredLocationId = env.GHL_LOCATION_ID;
		if (locationId !== configuredLocationId) {
			return NextResponse.json(
				{ error: `Location ID mismatch. Expected ${configuredLocationId}, got ${locationId}` },
				{ status: 400 }
			);
		}

		const conversationProviderId = env.GHL_CONVERSATION_PROVIDER_ID;
		if (!conversationProviderId) {
			return NextResponse.json(
				{ error: "GHL_CONVERSATION_PROVIDER_ID is not configured" },
				{ status: 500 }
			);
		}

		console.log(`[test-ghl-import] Importing message for contact ${contactId}`);

		try {
			const messageId = await addInboundMessage(contactId, text, {
				conversationProviderId,
				date: new Date().toISOString(),
			});

			return NextResponse.json({
				success: true,
				messageId,
				contactId,
				locationId,
				conversationProviderId,
				message: "Message imported successfully",
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorUrl = (error as { url?: string }).url || "unknown";
			const statusCode = errorMessage.includes("401") ? 401 :
			                   errorMessage.includes("404") ? 404 :
			                   errorMessage.includes("403") ? 403 : 500;

			console.error(`[test-ghl-import] Error:`, errorMessage);

			return NextResponse.json({
				success: false,
				error: errorMessage,
				url: errorUrl,
				contactId,
				locationId,
				conversationProviderId,
			}, { status: statusCode });
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("[test-ghl-import] Request error:", errorMessage);
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 }
		);
	}
}

