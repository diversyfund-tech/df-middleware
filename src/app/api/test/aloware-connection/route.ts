import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { getUsers, getContact } from "@/lib/aloware/client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Test Aloware Connection
 * 
 * Tests Aloware API connection and authentication.
 * 
 * GET /api/test/aloware-connection
 */
export async function GET(req: NextRequest) {
	const startTime = Date.now();
	const results: Record<string, unknown> = {
		timestamp: new Date().toISOString(),
		tests: {},
	};

	try {
		// Check if API token is configured
		if (!env.ALOWARE_API_TOKEN) {
			results.tests.authentication = {
				status: "⚪ Not Configured",
				apiTokenConfigured: false,
				details: "ALOWARE_API_TOKEN not set",
			};

			results.summary = "⚠️ Aloware API token not configured";
			return NextResponse.json(results, { status: 400 });
		}

		logger.info({}, "Testing Aloware connection");

		// Test 1: Authentication and Basic API Access
		try {
			const users = await getUsers();
			
			results.tests.authentication = {
				status: "✅ Connected",
				apiTokenConfigured: true,
				userCount: users.length,
				details: `Successfully authenticated. Found ${users.length} user(s)`,
				users: users.slice(0, 5).map(u => ({
					id: u.id,
					name: u.name,
					email: u.email,
				})),
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error({ error }, "Aloware authentication test failed");
			
			results.tests.authentication = {
				status: "❌ Failed",
				apiTokenConfigured: true,
				error: errorMessage,
				details: "Failed to authenticate with Aloware API",
			};

			results.summary = "❌ Aloware connection test failed";
			results.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
			return NextResponse.json(results, { status: 500 });
		}

		// Test 2: Contact Retrieval (if we have a test contact ID)
		const testContactId = req.nextUrl.searchParams.get("contactId");
		if (testContactId) {
			try {
				const contact = await getContact(testContactId);
				
				results.tests.contactRetrieval = {
					status: "✅ Success",
					contactId: testContactId,
					contactFound: true,
					contactName: contact.first_name && contact.last_name 
						? `${contact.first_name} ${contact.last_name}` 
						: contact.email || contact.phone_number || "Unknown",
					details: `Successfully retrieved contact ${testContactId}`,
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				logger.warn({ contactId: testContactId, error }, "Contact retrieval test failed");
				
				results.tests.contactRetrieval = {
					status: "⚠️ Failed",
					contactId: testContactId,
					contactFound: false,
					error: errorMessage,
					details: `Contact ${testContactId} not found or error retrieving`,
				};
			}
		} else {
			results.tests.contactRetrieval = {
				status: "⚪ Skipped",
				details: "No contactId provided. Add ?contactId=<id> to test contact retrieval",
			};
		}

		// Test 3: Webhook Configuration Check
		const webhookUser = env.ALOWARE_WEBHOOK_BASIC_USER;
		const webhookPass = env.ALOWARE_WEBHOOK_BASIC_PASS;

		results.tests.webhookConfiguration = {
			basicAuthUserConfigured: !!webhookUser,
			basicAuthPassConfigured: !!webhookPass,
			status: webhookUser && webhookPass ? "✅ Configured" : "⚠️ Partially Configured",
			details: webhookUser && webhookPass 
				? "Webhook Basic Auth credentials configured"
				: "Webhook Basic Auth credentials not fully configured",
		};

		// Summary
		const authStatus = (results.tests.authentication as { status?: string })?.status;
		const allTestsPassed = authStatus === "✅ Connected";

		results.summary = allTestsPassed
			? "✅ Aloware connection verified successfully"
			: "⚠️ Aloware connection test completed with issues";
		
		results.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
		results.configuration = {
			apiBaseUrl: "https://app.aloware.com/api/v1",
			apiTokenConfigured: !!env.ALOWARE_API_TOKEN,
			webhookAuthConfigured: !!(webhookUser && webhookPass),
		};

		return NextResponse.json(results, { status: allTestsPassed ? 200 : 500 });

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error({ error }, "Aloware connection test error");
		
		return NextResponse.json({
			success: false,
			error: "Internal server error",
			message: errorMessage,
			timestamp: new Date().toISOString(),
		}, { status: 500 });
	}
}
