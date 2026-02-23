#!/usr/bin/env bun
/**
 * Connection Verification Script
 * 
 * Tests connections to all integrated providers:
 * - Aloware
 * - GoHighLevel (GHL)
 * - Verity
 * - Database
 * - ElevenLabs (if configured)
 */

// Import environment variables directly
const env = {
	DATABASE_URL: process.env.DATABASE_URL!,
	ALOWARE_API_TOKEN: process.env.ALOWARE_API_TOKEN,
	GHL_API_KEY: process.env.GHL_API_KEY,
	GHL_LOCATION_ID: process.env.GHL_LOCATION_ID,
	GHL_CLIENT_ID: process.env.GHL_CLIENT_ID,
	GHL_CLIENT_SECRET: process.env.GHL_CLIENT_SECRET,
	VERITY_BASE_URL: process.env.VERITY_BASE_URL,
	VERITY_API_KEY: process.env.VERITY_API_KEY,
	CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
	ELEVENLABS_WEBHOOK_SECRET: process.env.ELEVENLABS_WEBHOOK_SECRET,
};

// Import modules using relative paths from scripts directory
import { db } from "../src/server/db/index.js";
import { ghlOauthTokens } from "../src/server/db/schema.js";
import { eq } from "drizzle-orm";
import { getUsers } from "../src/lib/aloware/client.js";
import { ghlRequest } from "../src/lib/ghl/client.js";
import { getGhlAccessToken } from "../src/lib/ghl/oauth-tokens.js";
import { proxyToVerity } from "../src/api-gateway/proxy.js";
import { getClerkSessionToken } from "../src/auth/clerk-token-manager.js";

interface ConnectionResult {
	provider: string;
	status: "connected" | "disconnected" | "error" | "not_configured";
	details: string;
	error?: string;
}

const results: ConnectionResult[] = [];

/**
 * Test Database Connection
 */
async function testDatabase(): Promise<ConnectionResult> {
	try {
		await db.execute({ sql: "SELECT 1", args: [] });
		return {
			provider: "PostgreSQL Database",
			status: "connected",
			details: "Database connection successful",
		};
	} catch (error) {
		return {
			provider: "PostgreSQL Database",
			status: "error",
			details: "Database connection failed",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test Aloware Connection
 */
async function testAloware(): Promise<ConnectionResult> {
	if (!env.ALOWARE_API_TOKEN) {
		return {
			provider: "Aloware",
			status: "not_configured",
			details: "ALOWARE_API_TOKEN not set",
		};
	}

	try {
		const users = await getUsers();
		return {
			provider: "Aloware",
			status: "connected",
			details: `Successfully connected. Found ${users.length} user(s)`,
		};
	} catch (error) {
		return {
			provider: "Aloware",
			status: "error",
			details: "Failed to connect to Aloware API",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test GHL Connection (PIT)
 */
async function testGHLPIT(): Promise<ConnectionResult> {
	if (!env.GHL_API_KEY) {
		return {
			provider: "GHL (Private Integration Token)",
			status: "not_configured",
			details: "GHL_API_KEY not set",
		};
	}

	if (!env.GHL_LOCATION_ID) {
		return {
			provider: "GHL (Private Integration Token)",
			status: "not_configured",
			details: "GHL_LOCATION_ID not set",
		};
	}

	try {
		// Test by fetching contacts (lightweight endpoint)
		const response = await ghlRequest<{ contacts?: unknown[] }>(
			"/contacts",
			{ method: "GET" }
		);
		
		const contactCount = Array.isArray(response) 
			? response.length 
			: (response.contacts?.length || 0);

		return {
			provider: "GHL (Private Integration Token)",
			status: "connected",
			details: `Successfully connected using PIT. Location: ${env.GHL_LOCATION_ID}`,
		};
	} catch (error) {
		return {
			provider: "GHL (Private Integration Token)",
			status: "error",
			details: "Failed to connect to GHL API with PIT",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test GHL OAuth Connection
 */
async function testGHLOAuth(): Promise<ConnectionResult> {
	if (!env.GHL_CLIENT_ID || !env.GHL_CLIENT_SECRET) {
		return {
			provider: "GHL (OAuth Marketplace App)",
			status: "not_configured",
			details: "GHL_CLIENT_ID or GHL_CLIENT_SECRET not set",
		};
	}

	if (!env.GHL_LOCATION_ID) {
		return {
			provider: "GHL (OAuth Marketplace App)",
			status: "not_configured",
			details: "GHL_LOCATION_ID not set",
		};
	}

	try {
		// Check if OAuth token exists in database
		const tokenRow = await db.query.ghlOauthTokens.findFirst({
			where: eq(ghlOauthTokens.locationId, env.GHL_LOCATION_ID.trim()),
		});

		if (!tokenRow) {
			return {
				provider: "GHL (OAuth Marketplace App)",
				status: "disconnected",
				details: "OAuth credentials configured but no token found in database. Please install the Marketplace App.",
			};
		}

		// Try to get/refresh token
		const token = await getGhlAccessToken(env.GHL_LOCATION_ID);
		
		// Test token by making a simple API call
		await ghlRequest<unknown>(
			"/contacts",
			{ method: "GET" },
			true // useOAuth
		);

		const expiresAt = new Date(tokenRow.expiresAt);
		const isExpired = expiresAt <= new Date();
		const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000 / 60);

		return {
			provider: "GHL (OAuth Marketplace App)",
			status: "connected",
			details: `OAuth token valid. Expires ${isExpired ? "EXPIRED" : `in ${expiresIn} minutes`}`,
		};
	} catch (error) {
		return {
			provider: "GHL (OAuth Marketplace App)",
			status: "error",
			details: "Failed to connect to GHL API with OAuth",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test Verity Connection
 */
async function testVerity(): Promise<ConnectionResult> {
	if (!env.VERITY_BASE_URL) {
		return {
			provider: "Verity",
			status: "not_configured",
			details: "VERITY_BASE_URL not set",
		};
	}

	if (!env.VERITY_API_KEY) {
		return {
			provider: "Verity",
			status: "not_configured",
			details: "VERITY_API_KEY not set",
		};
	}

	try {
		// Test by making a simple API call (try to get catalog or health endpoint)
		const response = await proxyToVerity(
			{
				endpoint: "/api/health",
				method: "GET",
			},
			env.VERITY_BASE_URL
		);

		if (response.success) {
			return {
				provider: "Verity",
				status: "connected",
				details: `Successfully connected to ${env.VERITY_BASE_URL}`,
			};
		} else {
			// Try alternative endpoint
			const altResponse = await proxyToVerity(
				{
					endpoint: "/api/comms/broadcasts",
					method: "GET",
					query: { limit: "1" },
				},
				env.VERITY_BASE_URL
			);

			if (altResponse.success) {
				return {
					provider: "Verity",
					status: "connected",
					details: `Successfully connected to ${env.VERITY_BASE_URL}`,
				};
			}

			return {
				provider: "Verity",
				status: "error",
				details: "Failed to connect to Verity API",
				error: response.error?.message || "Unknown error",
			};
		}
	} catch (error) {
		return {
			provider: "Verity",
			status: "error",
			details: "Failed to connect to Verity API",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test Verity with Clerk Authentication (for MCP)
 */
async function testVerityClerk(): Promise<ConnectionResult> {
	if (!env.VERITY_BASE_URL) {
		return {
			provider: "Verity (Clerk Auth - MCP)",
			status: "not_configured",
			details: "VERITY_BASE_URL not set",
		};
	}

	if (!env.CLERK_SECRET_KEY) {
		return {
			provider: "Verity (Clerk Auth - MCP)",
			status: "not_configured",
			details: "CLERK_SECRET_KEY not set",
		};
	}

	try {
		// Try to get Clerk session token
		const authToken = await getClerkSessionToken();
		
		// Test by making a simple API call with Clerk auth
		const response = await proxyToVerity(
			{
				endpoint: "/api/comms/broadcasts",
				method: "GET",
				query: { limit: "1" },
				authToken,
			},
			env.VERITY_BASE_URL
		);

		if (response.success) {
			return {
				provider: "Verity (Clerk Auth - MCP)",
				status: "connected",
				details: "Successfully connected with Clerk authentication",
			};
		} else {
			return {
				provider: "Verity (Clerk Auth - MCP)",
				status: "error",
				details: "Failed to connect with Clerk authentication",
				error: response.error?.message || "Unknown error",
			};
		}
	} catch (error) {
		return {
			provider: "Verity (Clerk Auth - MCP)",
			status: "error",
			details: "Failed to get Clerk token or connect",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test ElevenLabs Configuration
 */
async function testElevenLabs(): Promise<ConnectionResult> {
	if (!env.ELEVENLABS_WEBHOOK_SECRET) {
		return {
			provider: "ElevenLabs",
			status: "not_configured",
			details: "ELEVENLABS_WEBHOOK_SECRET not set (webhook verification only)",
		};
	}

	// ElevenLabs is webhook-based, so we can't test API connection directly
	// Just verify configuration exists
	return {
		provider: "ElevenLabs",
		status: "connected",
		details: "Webhook secret configured (webhook-based integration)",
	};
}

/**
 * Main function
 */
async function main() {
	console.log("\n🔍 DF-Middleware Connection Verification\n");
	console.log("=" .repeat(60));

	// Test all connections
	results.push(await testDatabase());
	results.push(await testAloware());
	results.push(await testGHLPIT());
	results.push(await testGHLOAuth());
	results.push(await testVerity());
	results.push(await testVerityClerk());
	results.push(await testElevenLabs());

	// Print results
	console.log("\n📊 Connection Status:\n");

	let allConnected = true;
	for (const result of results) {
		const icon = 
			result.status === "connected" ? "✅" :
			result.status === "disconnected" ? "⚠️" :
			result.status === "not_configured" ? "⚪" :
			"❌";

		console.log(`${icon} ${result.provider}`);
		console.log(`   Status: ${result.status}`);
		console.log(`   Details: ${result.details}`);
		if (result.error) {
			console.log(`   Error: ${result.error}`);
		}
		console.log();

		if (result.status !== "connected" && result.status !== "not_configured") {
			allConnected = false;
		}
	}

	// Summary
	console.log("=" .repeat(60));
	if (allConnected) {
		console.log("\n✅ All configured connections are working!\n");
	} else {
		console.log("\n⚠️  Some connections have issues. Please review the errors above.\n");
	}

	// Close database connection
	// Note: db.$client might not exist, try alternative
	try {
		if (typeof (db as any).$client?.end === "function") {
			await (db as any).$client.end();
		}
	} catch {
		// Ignore if connection closing fails
	}
}

main().catch((error) => {
	console.error("\n❌ Fatal error:", error);
	process.exit(1);
});
