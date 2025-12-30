import { db } from "@/server/db";
import { ghlOauthTokens } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";

/**
 * Get GHL OAuth access token for a location
 * Automatically refreshes if expired or near-expiry (within 5 minutes)
 */
export async function getGhlAccessToken(locationId: string): Promise<string> {
	// Trim locationId to handle any whitespace/newlines
	const trimmedLocationId = locationId.trim();
	// Load token from database
	const tokenRow = await db.query.ghlOauthTokens.findFirst({
		where: eq(ghlOauthTokens.locationId, trimmedLocationId),
	});

	if (!tokenRow) {
		throw new Error(
			`No OAuth token found for location ${locationId}. Please install the Marketplace App first.`
		);
	}

	// Check if token is expired or near-expiry (within 5 minutes)
	const now = new Date();
	const expiresAt = new Date(tokenRow.expiresAt);
	const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

	if (expiresAt <= fiveMinutesFromNow) {
		// Token expired or near-expiry, refresh it
		if (!tokenRow.refreshToken) {
			throw new Error(
				`OAuth token expired for location ${locationId} and no refresh token available. Please reinstall the Marketplace App.`
			);
		}

		console.log(`[GHL OAuth] Refreshing expired token for location ${locationId}`);
		return await refreshGhlAccessToken(locationId, tokenRow.refreshToken);
	}

	return tokenRow.accessToken;
}

/**
 * Refresh GHL OAuth access token using refresh token
 */
async function refreshGhlAccessToken(locationId: string, refreshToken: string): Promise<string> {
	const clientId = env.GHL_CLIENT_ID;
	const clientSecret = env.GHL_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("GHL_CLIENT_ID and GHL_CLIENT_SECRET must be configured for token refresh");
	}

	const tokenUrl = "https://services.leadconnectorhq.com/oauth/token";
	const params = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});

	const response = await fetch(tokenUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Accept": "application/json",
		},
		body: params.toString(),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to refresh OAuth token: ${response.status} ${errorText}`);
	}

	const tokenData = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		token_type?: string;
		scope?: string;
		expires_in?: number;
	};

	// Compute expires_at from expires_in (typically in seconds)
	const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour if not provided
	const expiresAt = new Date(Date.now() + expiresIn * 1000);

	// Update token in database
	await db
		.update(ghlOauthTokens)
		.set({
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep old one
			tokenType: tokenData.token_type || "Bearer",
			scope: tokenData.scope || null,
			expiresAt,
			updatedAt: new Date(),
		})
		.where(eq(ghlOauthTokens.locationId, trimmedLocationId));

	console.log(`[GHL OAuth] Token refreshed successfully for location ${locationId}`);

	return tokenData.access_token;
}

/**
 * Store GHL OAuth tokens from installation callback
 */
export async function storeGhlOauthTokens(
	locationId: string,
	tokenData: {
		access_token: string;
		refresh_token?: string;
		token_type?: string;
		scope?: string;
		expires_in?: number;
	}
): Promise<void> {
	// Trim locationId to handle any whitespace/newlines
	const trimmedLocationId = locationId.trim();
	// Compute expires_at from expires_in (typically in seconds)
	const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour if not provided
	const expiresAt = new Date(Date.now() + expiresIn * 1000);

	// Upsert token (insert or update if location_id already exists)
	await db
		.insert(ghlOauthTokens)
		.values({
			locationId: trimmedLocationId,
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token || null,
			tokenType: tokenData.token_type || "Bearer",
			scope: tokenData.scope || null,
			expiresAt,
		})
		.onConflictDoUpdate({
			target: ghlOauthTokens.locationId,
			set: {
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token || null,
				tokenType: tokenData.token_type || "Bearer",
				scope: tokenData.scope || null,
				expiresAt,
				updatedAt: new Date(),
			},
		});

		console.log(`[GHL OAuth] Tokens stored for location ${trimmedLocationId}`);
}

