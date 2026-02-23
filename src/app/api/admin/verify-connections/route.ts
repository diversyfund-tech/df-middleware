import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { ghlOauthTokens } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getUsers } from "@/lib/aloware/client";
import { ghlRequest } from "@/lib/ghl/client";
import { getGhlAccessToken } from "@/lib/ghl/oauth-tokens";
import { proxyToVerity } from "@/api-gateway/proxy";
import { getClerkSessionToken } from "@/auth/clerk-token-manager";

export const dynamic = "force-dynamic";

interface ConnectionResult {
	provider: string;
	status: "connected" | "disconnected" | "error" | "not_configured";
	details: string;
	error?: string;
}

/**
 * Verify Connections
 * 
 * GET /api/admin/verify-connections
 * 
 * Tests connections to all integrated providers
 */
export async function GET(req: NextRequest) {
	try {
		const results: ConnectionResult[] = [];

		// Test Database Connection
		try {
			const result = await db.execute({ sql: "SELECT 1 as test", args: [] });
			results.push({
				provider: "PostgreSQL Database",
				status: "connected",
				details: "Database connection successful",
			});
		} catch (error) {
			results.push({
				provider: "PostgreSQL Database",
				status: "error",
				details: "Database connection failed",
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// Test Aloware Connection
		if (!env.ALOWARE_API_TOKEN) {
			results.push({
				provider: "Aloware",
				status: "not_configured",
				details: "ALOWARE_API_TOKEN not set",
			});
		} else {
			try {
				const users = await getUsers();
				results.push({
					provider: "Aloware",
					status: "connected",
					details: `Successfully connected. Found ${users.length} user(s)`,
				});
			} catch (error) {
				results.push({
					provider: "Aloware",
					status: "error",
					details: "Failed to connect to Aloware API",
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Test GHL Connection (PIT)
		if (!env.GHL_API_KEY || !env.GHL_LOCATION_ID) {
			results.push({
				provider: "GHL (Private Integration Token)",
				status: "not_configured",
				details: !env.GHL_API_KEY ? "GHL_API_KEY not set" : "GHL_LOCATION_ID not set",
			});
		} else {
			try {
				await ghlRequest<{ contacts?: unknown[] }>(
					"/contacts",
					{ method: "GET" }
				);
				results.push({
					provider: "GHL (Private Integration Token)",
					status: "connected",
					details: `Successfully connected using PIT. Location: ${env.GHL_LOCATION_ID}`,
				});
			} catch (error) {
				results.push({
					provider: "GHL (Private Integration Token)",
					status: "error",
					details: "Failed to connect to GHL API with PIT",
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Test GHL OAuth Connection
		if (!env.GHL_CLIENT_ID || !env.GHL_CLIENT_SECRET || !env.GHL_LOCATION_ID) {
			results.push({
				provider: "GHL (OAuth Marketplace App)",
				status: "not_configured",
				details: !env.GHL_CLIENT_ID || !env.GHL_CLIENT_SECRET 
					? "GHL_CLIENT_ID or GHL_CLIENT_SECRET not set"
					: "GHL_LOCATION_ID not set",
			});
		} else {
			try {
				const tokenRow = await db.query.ghlOauthTokens.findFirst({
					where: eq(ghlOauthTokens.locationId, env.GHL_LOCATION_ID.trim()),
				});

				if (!tokenRow) {
					results.push({
						provider: "GHL (OAuth Marketplace App)",
						status: "disconnected",
						details: "OAuth credentials configured but no token found in database. Please install the Marketplace App.",
					});
				} else {
					const token = await getGhlAccessToken(env.GHL_LOCATION_ID);
					await ghlRequest<unknown>(
						"/contacts",
						{ method: "GET" },
						true // useOAuth
					);

					const expiresAt = new Date(tokenRow.expiresAt);
					const isExpired = expiresAt <= new Date();
					const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000 / 60);

					results.push({
						provider: "GHL (OAuth Marketplace App)",
						status: "connected",
						details: `OAuth token valid. Expires ${isExpired ? "EXPIRED" : `in ${expiresIn} minutes`}`,
					});
				}
			} catch (error) {
				results.push({
					provider: "GHL (OAuth Marketplace App)",
					status: "error",
					details: "Failed to connect to GHL API with OAuth",
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Test Verity Connection
		if (!env.VERITY_BASE_URL || !env.VERITY_API_KEY) {
			results.push({
				provider: "Verity",
				status: "not_configured",
				details: !env.VERITY_BASE_URL ? "VERITY_BASE_URL not set" : "VERITY_API_KEY not set",
			});
		} else {
			try {
				const response = await proxyToVerity(
					{
						endpoint: "/api/health",
						method: "GET",
					},
					env.VERITY_BASE_URL
				);

				if (response.success) {
					results.push({
						provider: "Verity",
						status: "connected",
						details: `Successfully connected to ${env.VERITY_BASE_URL}`,
					});
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
						results.push({
							provider: "Verity",
							status: "connected",
							details: `Successfully connected to ${env.VERITY_BASE_URL}`,
						});
					} else {
						results.push({
							provider: "Verity",
							status: "error",
							details: "Failed to connect to Verity API",
							error: response.error?.message || "Unknown error",
						});
					}
				}
			} catch (error) {
				results.push({
					provider: "Verity",
					status: "error",
					details: "Failed to connect to Verity API",
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Test Verity with Clerk Authentication (for MCP)
		if (!env.VERITY_BASE_URL || !env.CLERK_SECRET_KEY) {
			results.push({
				provider: "Verity (Clerk Auth - MCP)",
				status: "not_configured",
				details: !env.VERITY_BASE_URL ? "VERITY_BASE_URL not set" : "CLERK_SECRET_KEY not set",
			});
		} else {
			try {
				const authToken = await getClerkSessionToken();
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
					results.push({
						provider: "Verity (Clerk Auth - MCP)",
						status: "connected",
						details: "Successfully connected with Clerk authentication",
					});
				} else {
					results.push({
						provider: "Verity (Clerk Auth - MCP)",
						status: "error",
						details: "Failed to connect with Clerk authentication",
						error: response.error?.message || "Unknown error",
					});
				}
			} catch (error) {
				results.push({
					provider: "Verity (Clerk Auth - MCP)",
					status: "error",
					details: "Failed to get Clerk token or connect",
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Test ElevenLabs Configuration
		if (!env.ELEVENLABS_WEBHOOK_SECRET) {
			results.push({
				provider: "ElevenLabs",
				status: "not_configured",
				details: "ELEVENLABS_WEBHOOK_SECRET not set (webhook verification only)",
			});
		} else {
			results.push({
				provider: "ElevenLabs",
				status: "connected",
				details: "Webhook secret configured (webhook-based integration)",
			});
		}

		// Calculate summary
		const connected = results.filter(r => r.status === "connected").length;
		const errors = results.filter(r => r.status === "error").length;
		const disconnected = results.filter(r => r.status === "disconnected").length;
		const notConfigured = results.filter(r => r.status === "not_configured").length;

		return NextResponse.json({
			success: true,
			timestamp: new Date().toISOString(),
			summary: {
				total: results.length,
				connected,
				errors,
				disconnected,
				notConfigured,
			},
			results,
		});
	} catch (error) {
		return NextResponse.json({
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}, { status: 500 });
	}
}
