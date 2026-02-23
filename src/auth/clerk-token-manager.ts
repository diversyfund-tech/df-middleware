/**
 * Clerk Token Manager
 * 
 * Manages Clerk session tokens for authenticating with Verity API.
 * Handles token generation, caching, and refresh.
 */

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_API_BASE = "https://api.clerk.com/v1";

interface CachedToken {
	token: string;
	expiresAt: number;
	sessionId: string;
}

// In-memory token cache
let cachedToken: CachedToken | null = null;
let tokenRefreshPromise: Promise<string> | null = null;

/**
 * Get a valid Clerk session token
 * Returns cached token if still valid, otherwise fetches a new one
 */
export async function getClerkSessionToken(): Promise<string> {
	if (!CLERK_SECRET_KEY) {
		throw new Error("CLERK_SECRET_KEY is not configured. Required for MCP server authentication.");
	}

	// Check if we have a valid cached token
	if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
		// Token is valid and has at least 5 minutes remaining
		return cachedToken.token;
	}

	// If a refresh is already in progress, wait for it
	if (tokenRefreshPromise) {
		return tokenRefreshPromise;
	}

	// Start a new token refresh
	tokenRefreshPromise = refreshClerkToken();
	
	try {
		const token = await tokenRefreshPromise;
		return token;
	} finally {
		tokenRefreshPromise = null;
	}
}

/**
 * Refresh the Clerk session token
 */
async function refreshClerkToken(): Promise<string> {
	if (!CLERK_SECRET_KEY) {
		throw new Error("CLERK_SECRET_KEY is not configured");
	}

	console.error("[clerk-token-manager] Refreshing Clerk session token...");

	try {
		// Get Clerk client to access users
		const { createClerkClient } = await import("@clerk/backend");
		const client = createClerkClient({ secretKey: CLERK_SECRET_KEY });

		// Get first available user
		const users = await client.users.getUserList({ limit: 1 });
		
		if (users.data.length === 0) {
			throw new Error("No users found in Clerk. Cannot create session token.");
		}

		const userId = users.data[0].id;
		console.error(`[clerk-token-manager] Found user: ${userId}`);

		// Get user sessions
		const sessions = await client.sessions.getSessionList({ userId });
		
		if (sessions.data.length === 0) {
			throw new Error(`No sessions found for user ${userId}. User needs to sign in first.`);
		}

		const session = sessions.data[0];
		console.error(`[clerk-token-manager] Found session: ${session.id}`);

		// Create session token via Clerk API
		const clerkApiUrl = `${CLERK_API_BASE}/sessions/${session.id}/tokens`;
		const tokenResponse = await fetch(clerkApiUrl, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${CLERK_SECRET_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				expires_in_seconds: 3600, // 1 hour
			}),
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			throw new Error(`Failed to create session token: ${tokenResponse.status} ${errorText}`);
		}

		const tokenData = await tokenResponse.json();
		const jwt = tokenData.jwt || tokenData.token;

		if (!jwt) {
			throw new Error("No JWT token in response from Clerk API");
		}

		// Cache the token with expiration (set to expire 5 minutes before actual expiration for safety)
		cachedToken = {
			token: jwt,
			expiresAt: Date.now() + (3600 - 300) * 1000, // 55 minutes from now
			sessionId: session.id,
		};

		console.error(`[clerk-token-manager] Successfully created session token (expires in ~55 minutes)`);
		return jwt;
	} catch (error) {
		console.error("[clerk-token-manager] Error refreshing token:", error);
		throw error;
	}
}

/**
 * Clear the cached token (useful for testing or forced refresh)
 */
export function clearCachedToken(): void {
	cachedToken = null;
	tokenRefreshPromise = null;
}
