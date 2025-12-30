import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { getGhlAccessToken } from "@/lib/ghl/oauth-tokens";
import { ghlRequest } from "@/lib/ghl/client";

export const dynamic = "force-dynamic";

/**
 * Test Provider Connection
 * 
 * Tests if we can successfully connect to GHL using the conversation provider.
 * Tries to create a conversation with the provider to verify it's valid.
 * 
 * GET /api/test/test-provider-connection?contactId=<contactId>
 */
export async function GET(req: NextRequest) {
	try {
		const locationId = env.GHL_LOCATION_ID?.trim();
		const contactId = req.nextUrl.searchParams.get("contactId")?.trim();
		const conversationProviderId = env.GHL_CONVERSATION_PROVIDER_ID?.trim();

		if (!locationId) {
			return NextResponse.json({
				error: "GHL_LOCATION_ID is not configured",
			}, { status: 500 });
		}

		if (!contactId) {
			return NextResponse.json({
				error: "contactId query parameter is required",
				example: "/api/test/test-provider-connection?contactId=A94aNbVMezt0w4N4rVE5",
			}, { status: 400 });
		}

		if (!conversationProviderId) {
			return NextResponse.json({
				error: "GHL_CONVERSATION_PROVIDER_ID is not configured",
			}, { status: 500 });
		}

		// Test 1: Get OAuth token
		let oauthToken: string;
		try {
			oauthToken = await getGhlAccessToken(locationId);
			console.log("[test-provider] OAuth token retrieved successfully");
		} catch (error) {
			return NextResponse.json({
				success: false,
				test: "OAuth token retrieval",
				error: error instanceof Error ? error.message : String(error),
			}, { status: 500 });
		}

		// Test 2: Try to search for existing conversation
		let searchResult: unknown = null;
		try {
			const searchUrl = `/conversations?contactId=${contactId}&conversationProviderId=${conversationProviderId}`;
			searchResult = await ghlRequest<{ conversations?: unknown[]; data?: unknown[] }>(
				searchUrl,
				{},
				true // useOAuth
			);
			console.log("[test-provider] Conversation search successful");
		} catch (error) {
			console.log("[test-provider] Conversation search failed (this is OK if no conversation exists):", error instanceof Error ? error.message : String(error));
		}

		// Test 3: Try to create a conversation
		let createResult: unknown = null;
		let createError: string | null = null;
		try {
			const createBody = {
				locationId,
				contactId,
				conversationProviderId,
			};

			createResult = await ghlRequest<{ conversation?: { id: string }; id?: string; data?: { id: string } }>(
				"/conversations",
				{
					method: "POST",
					body: JSON.stringify(createBody),
				},
				true // useOAuth
			);
			console.log("[test-provider] Conversation creation successful");
		} catch (error) {
			createError = error instanceof Error ? error.message : String(error);
			console.error("[test-provider] Conversation creation failed:", createError);
		}

		// Extract conversation ID if created
		const conversationId = 
			(createResult as { conversation?: { id: string } })?.conversation?.id ||
			(createResult as { id?: string })?.id ||
			(createResult as { data?: { id: string } })?.data?.id ||
			null;

		return NextResponse.json({
			success: true,
			tests: {
				oauthToken: {
					status: "✅ Success",
					hasToken: !!oauthToken,
					tokenPrefix: oauthToken.substring(0, 10) + "...",
				},
				conversationSearch: {
					status: searchResult ? "✅ Success" : "⚠️ No existing conversation found (this is OK)",
					result: searchResult,
				},
				conversationCreation: {
					status: createResult ? "✅ Success" : "❌ Failed",
					conversationId,
					error: createError,
					result: createResult,
				},
			},
			configuration: {
				locationId,
				contactId,
				conversationProviderId,
			},
			summary: createResult 
				? "✅ Provider connection successful! Conversation created."
				: createError?.includes("Incorrect conversationProviderId")
					? "❌ Provider ID validation failed - check provider ID and type"
					: "⚠️ Provider connection test completed with errors",
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("[test-provider] Error:", errorMessage);
		return NextResponse.json({
			success: false,
			error: "Internal server error",
			message: errorMessage,
		}, { status: 500 });
	}
}

