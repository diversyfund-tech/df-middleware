import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { storeGhlOauthTokens } from "@/lib/ghl/oauth-tokens";

export const dynamic = "force-dynamic";

/**
 * GHL OAuth Callback Endpoint
 * 
 * Handles OAuth redirects from GoHighLevel Marketplace App installation.
 * 
 * Flow:
 * 1. User installs app in GHL → Redirected to GHL OAuth
 * 2. User authorizes → GHL redirects here with code
 * 3. We exchange code for access token
 * 4. Store token and redirect to success page
 */
export async function GET(req: NextRequest) {
	const searchParams = req.nextUrl.searchParams;
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const error = searchParams.get("error");
	const errorDescription = searchParams.get("error_description");

	console.log("[ghl.oauth] OAuth callback received", { code: code ? "present" : "missing", state, error });

	// Handle OAuth errors
	if (error) {
		console.error("[ghl.oauth] OAuth error:", error, errorDescription);
		return NextResponse.json({
			success: false,
			error: error,
			errorDescription: errorDescription || null,
		}, { status: 400 });
	}

	// Missing authorization code
	if (!code) {
		console.error("[ghl.oauth] Missing authorization code");
		return NextResponse.json({
			success: false,
			error: "missing_code",
			message: "Authorization code is required",
		}, { status: 400 });
	}

	const clientId = env.GHL_CLIENT_ID?.trim();
	const clientSecret = env.GHL_CLIENT_SECRET?.trim();

	if (!clientId || !clientSecret) {
		console.error("[ghl.oauth] Missing OAuth credentials", {
			hasClientId: !!env.GHL_CLIENT_ID,
			hasClientSecret: !!env.GHL_CLIENT_SECRET,
			clientIdLength: env.GHL_CLIENT_ID?.length,
			clientSecretLength: env.GHL_CLIENT_SECRET?.length,
		});
		return NextResponse.json({
			success: false,
			error: "missing_credentials",
			message: "OAuth client ID and secret must be configured",
		}, { status: 500 });
	}

	try {
		// Exchange authorization code for access token
		// GHL Marketplace OAuth uses services.leadconnectorhq.com
		// OAuth2 token exchange typically uses form-encoded data, not JSON
		const tokenUrl = "https://services.leadconnectorhq.com/oauth/token";
		
		// Build form-encoded body (OAuth2 standard)
		const params = new URLSearchParams({
			client_id: clientId.trim(),
			client_secret: clientSecret.trim(),
			grant_type: "authorization_code",
			code: code.trim(),
			redirect_uri: (req.nextUrl.origin + "/leadconnector/oauth").trim(),
		});
		
		console.log("[ghl.oauth] Token exchange params:", {
			client_id: clientId.substring(0, 10) + "...",
			has_client_secret: !!clientSecret,
			redirect_uri: req.nextUrl.origin + "/leadconnector/oauth",
		});
		
		console.log("[ghl.oauth] Exchanging code for token at:", tokenUrl);
		console.log("[ghl.oauth] Redirect URI:", req.nextUrl.origin + "/leadconnector/oauth");
		
		const tokenResponse = await fetch(tokenUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Accept": "application/json",
			},
			body: params.toString(),
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			console.error("[ghl.oauth] Token exchange failed:", errorText);
			return NextResponse.json({
				success: false,
				error: "token_exchange_failed",
				details: errorText,
			}, { status: 500 });
		}

		const tokenData = await tokenResponse.json();
		console.log("[ghl.oauth] Token exchange successful");

		// Extract location ID from token response (GHL typically includes this)
		const locationId = tokenData.locationId || tokenData.location_id || state;

		if (!locationId) {
			throw new Error("Location ID not found in token response or state");
		}

		// Store tokens in database
		await storeGhlOauthTokens(locationId, {
			access_token: tokenData.access_token,
			refresh_token: tokenData.refresh_token,
			token_type: tokenData.token_type,
			scope: tokenData.scope,
			expires_in: tokenData.expires_in,
		});

		console.log("[ghl.oauth] Tokens stored successfully", {
			locationId,
			hasAccessToken: !!tokenData.access_token,
			hasRefreshToken: !!tokenData.refresh_token,
		});

		// Return success response
		return NextResponse.json({
			success: true,
			message: "OAuth authorization successful",
			locationId,
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("[ghl.oauth] Error processing OAuth callback:", errorMessage);
		return NextResponse.json({
			success: false,
			error: "processing_error",
			message: errorMessage,
		}, { status: 500 });
	}
}

/**
 * OAuth Success/Error Page
 * 
 * Displays OAuth callback result to user
 */
export async function POST(req: NextRequest) {
	// Handle POST requests if needed (e.g., token refresh)
	return NextResponse.json({ error: "POST not supported" }, { status: 405 });
}

