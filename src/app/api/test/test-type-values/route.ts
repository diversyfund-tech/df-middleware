import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { ghlRequest } from "@/lib/ghl/client";

export const dynamic = "force-dynamic";

/**
 * Test Different Type Values
 * 
 * Tests different type enum values to find the correct one for GHL message import.
 * 
 * GET /api/test/test-type-values?contactId=<contactId>&phone=<phone>
 */
export async function GET(req: NextRequest) {
	try {
		const locationId = env.GHL_LOCATION_ID?.trim();
		const contactId = req.nextUrl.searchParams.get("contactId")?.trim();
		const phone = req.nextUrl.searchParams.get("phone")?.trim();
		const conversationProviderId = env.GHL_CONVERSATION_PROVIDER_ID?.trim();

		if (!locationId || !contactId || !phone || !conversationProviderId) {
			return NextResponse.json({
				error: "Missing required parameters",
				required: ["contactId", "phone"],
				example: "/api/test/test-type-values?contactId=A94aNbVMezt0w4N4rVE5&phone=%2B19192715870",
			}, { status: 400 });
		}

		// Test different type values
		const typeValues = ["SMS", "sms", "TEXT", "Text", "text", "Sms"];
		const results: Array<{ type: string; success: boolean; error?: string }> = [];

		for (const typeValue of typeValues) {
			try {
				const body = {
					locationId,
					contactId,
					conversationProviderId,
					message: `Test message with type: ${typeValue}`,
					type: typeValue,
					phone,
					dateSent: new Date().toISOString(),
				};

				await ghlRequest(
					"/conversations/messages/inbound",
					{
						method: "POST",
						body: JSON.stringify(body),
					},
					true // useOAuth
				);

				results.push({ type: typeValue, success: true });
				// If one succeeds, we found it!
				break;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				results.push({
					type: typeValue,
					success: false,
					error: errorMessage.includes("type") ? errorMessage : "Other error",
				});
			}
		}

		const successfulType = results.find(r => r.success)?.type;

		return NextResponse.json({
			success: !!successfulType,
			successfulType,
			results,
			summary: successfulType
				? `✅ Found valid type: "${successfulType}"`
				: "❌ No valid type found. Check provider configuration in GHL.",
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return NextResponse.json({
			success: false,
			error: errorMessage,
		}, { status: 500 });
	}
}

