import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { ghlRequest } from "@/lib/ghl/client";
import { getGhlAccessToken } from "@/lib/ghl/oauth-tokens";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Test GHL Connection
 * 
 * Tests both PIT (Private Integration Token) and OAuth authentication methods.
 * 
 * GET /api/test/ghl-connection
 */
export async function GET(req: NextRequest) {
	const startTime = Date.now();
	const results: Record<string, unknown> = {
		timestamp: new Date().toISOString(),
		locationId: env.GHL_LOCATION_ID,
		tests: {},
	};

	try {
		// Test 1: PIT (Private Integration Token) Connection
		if (env.GHL_API_KEY) {
			logger.info({ method: "PIT" }, "Testing GHL connection with Private Integration Token");
			
			try {
				// Simple API call to verify connection
				const contacts = await ghlRequest<{ contacts?: unknown[]; data?: unknown[] }>(
					"/contacts",
					{ method: "GET" },
					false // useOAuth = false (use PIT)
				);

				const contactCount = 
					(contacts as { contacts?: unknown[] })?.contacts?.length ||
					(contacts as { data?: unknown[] })?.data?.length ||
					0;

				results.tests.pit = {
					status: "✅ Connected",
					method: "Private Integration Token",
					apiKeyConfigured: true,
					contactCount,
					details: `Successfully retrieved ${contactCount} contact(s)`,
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				logger.error({ method: "PIT", error }, "GHL PIT connection test failed");
				
				results.tests.pit = {
					status: "❌ Failed",
					method: "Private Integration Token",
					apiKeyConfigured: true,
					error: errorMessage,
				};
			}
		} else {
			results.tests.pit = {
				status: "⚪ Not Configured",
				method: "Private Integration Token",
				apiKeyConfigured: false,
				details: "GHL_API_KEY not set",
			};
		}

		// Test 2: OAuth Connection
		if (env.GHL_CLIENT_ID && env.GHL_CLIENT_SECRET && env.GHL_LOCATION_ID) {
			logger.info({ method: "OAuth" }, "Testing GHL connection with OAuth");
			
			try {
				// Get OAuth token
				const oauthToken = await getGhlAccessToken(env.GHL_LOCATION_ID);
				
				// Test API call with OAuth
				const contacts = await ghlRequest<{ contacts?: unknown[]; data?: unknown[] }>(
					"/contacts",
					{ method: "GET" },
					true // useOAuth = true
				);

				const contactCount = 
					(contacts as { contacts?: unknown[] })?.contacts?.length ||
					(contacts as { data?: unknown[] })?.data?.length ||
					0;

				results.tests.oauth = {
					status: "✅ Connected",
					method: "OAuth Marketplace App",
					clientIdConfigured: true,
					clientSecretConfigured: true,
					tokenRetrieved: true,
					tokenPrefix: oauthToken.substring(0, 10) + "...",
					contactCount,
					details: `Successfully retrieved ${contactCount} contact(s) using OAuth`,
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				logger.error({ method: "OAuth", error }, "GHL OAuth connection test failed");
				
				results.tests.oauth = {
					status: "❌ Failed",
					method: "OAuth Marketplace App",
					clientIdConfigured: true,
					clientSecretConfigured: true,
					error: errorMessage,
				};
			}
		} else {
			results.tests.oauth = {
				status: "⚪ Not Configured",
				method: "OAuth Marketplace App",
				clientIdConfigured: !!env.GHL_CLIENT_ID,
				clientSecretConfigured: !!env.GHL_CLIENT_SECRET,
				locationIdConfigured: !!env.GHL_LOCATION_ID,
				details: "OAuth credentials not fully configured",
			};
		}

		// Summary
		const pitStatus = (results.tests.pit as { status?: string })?.status;
		const oauthStatus = (results.tests.oauth as { status?: string })?.status;
		
		const allConnected = 
			(pitStatus === "✅ Connected" || pitStatus === "⚪ Not Configured") &&
			(oauthStatus === "✅ Connected" || oauthStatus === "⚪ Not Configured");

		results.summary = allConnected
			? "✅ GHL connection verified successfully"
			: "⚠️ Some GHL connection tests failed - check details above";
		
		results.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

		return NextResponse.json(results, { status: allConnected ? 200 : 500 });

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error({ error }, "GHL connection test error");
		
		return NextResponse.json({
			success: false,
			error: "Internal server error",
			message: errorMessage,
			timestamp: new Date().toISOString(),
		}, { status: 500 });
	}
}
