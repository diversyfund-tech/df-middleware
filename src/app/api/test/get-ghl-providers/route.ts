import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export const dynamic = "force-dynamic";

/**
 * Get GHL Conversation Providers
 * 
 * Fetches all conversation providers for the location to find the conversationProviderId
 * 
 * GET /api/test/get-ghl-providers
 */
export async function GET(req: NextRequest) {
	try {
		const locationId = env.GHL_LOCATION_ID;
		const apiKey = env.GHL_API_KEY;

		if (!locationId || !apiKey) {
			return NextResponse.json({
				error: "GHL_LOCATION_ID and GHL_API_KEY must be configured",
			}, { status: 500 });
		}

		// Fetch providers from GHL API
		// Try multiple possible endpoint paths
		const endpoints = [
			`https://services.leadconnectorhq.com/conversations/providers?locationId=${locationId}`,
			`https://services.leadconnectorhq.com/conversation-providers?locationId=${locationId}`,
			`https://services.leadconnectorhq.com/providers?locationId=${locationId}`,
		];

		let response: Response | null = null;
		let data: unknown = null;
		let lastError: string | null = null;

		for (const url of endpoints) {
			try {
				console.log("[get-ghl-providers] Trying endpoint:", url);
				response = await fetch(url, {
					method: "GET",
					headers: {
						"Authorization": `Bearer ${apiKey}`,
						"Accept": "application/json",
						"Version": "2021-07-28",
					},
				});

				if (response.ok) {
					data = await response.json();
					console.log("[get-ghl-providers] Success with endpoint:", url);
					break;
				} else {
					const errorText = await response.text();
					lastError = errorText;
					console.log(`[get-ghl-providers] Failed with ${response.status}:`, errorText);
				}
			} catch (err) {
				lastError = err instanceof Error ? err.message : String(err);
				console.log("[get-ghl-providers] Error:", lastError);
				continue;
			}
		}

		if (!response || !response.ok) {
			return NextResponse.json({
				error: "Failed to fetch providers",
				status: response?.status || 500,
				details: lastError || "All endpoints failed",
				triedEndpoints: endpoints,
			}, { status: response?.status || 500 });
		}

		// data is already set from the loop above
		console.log("[get-ghl-providers] Providers response:", JSON.stringify(data, null, 2));

		// Extract providers array (could be providers, data, or direct array)
		const providers = (data as { providers?: unknown[]; data?: unknown[] }).providers || 
		                  (data as { providers?: unknown[]; data?: unknown[] }).data || 
		                  (Array.isArray(data) ? data : []);

		// Find SMS providers (especially ones matching our app)
		const smsProviders = providers.filter((p: unknown) => {
			const provider = p as { type?: string };
			return provider.type === "SMS" || provider.type === "sms";
		});

		// Find providers that might be ours (check name patterns)
		const ourProviders = smsProviders.filter((p: unknown) => {
			const provider = p as { name?: string };
			const name = provider.name?.toLowerCase() || "";
			return name.includes("df") || 
			       name.includes("middleware") ||
			       name.includes("telnyx") ||
			       name.includes("verity");
		});

		return NextResponse.json({
			success: true,
			locationId,
			totalProviders: providers.length,
			smsProviders: smsProviders.length,
			ourProviders: ourProviders.length,
			allProviders: providers,
			smsProvidersList: smsProviders,
			recommendedProvider: ourProviders.length > 0 ? ourProviders[0] : smsProviders[0] || null,
			instructions: {
				step1: "Look for your SMS provider in 'smsProvidersList' or 'allProviders'",
				step2: "Find the provider with name matching your Marketplace App",
				step3: "Copy the 'id' field - that's your conversationProviderId",
				step4: "Add to .env.local: GHL_CONVERSATION_PROVIDER_ID=<id>",
			},
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("[get-ghl-providers] Error:", errorMessage);
		return NextResponse.json({
			error: "Internal server error",
			message: errorMessage,
		}, { status: 500 });
	}
}

