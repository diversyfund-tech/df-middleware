/**
 * Verity Authentication
 * 
 * Handles Clerk JWT verification for Verity API requests.
 * 
 * See CLERK_AUTHENTICATION_GUIDE.md for complete implementation details.
 */

import { clerkClient } from "@clerk/backend";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
	console.warn("[verity-auth] CLERK_SECRET_KEY not configured");
}

/**
 * Extract token from Authorization header
 */
export function extractAuthToken(authHeader: string): string | null {
	if (!authHeader) {
		return null;
	}

	const match = authHeader.match(/^Bearer\s+(.+)$/i);
	return match ? match[1] : null;
}

/**
 * Verify Clerk JWT token
 * 
 * Verifies a Clerk session token using the Clerk SDK.
 */
export async function verifyAuthToken(token: string): Promise<{
	userId: string;
	sessionClaims?: {
		admin?: boolean;
		[key: string]: unknown;
	};
}> {
	if (!CLERK_SECRET_KEY) {
		throw new Error("CLERK_SECRET_KEY not configured");
	}

	try {
		const client = clerkClient({ secretKey: CLERK_SECRET_KEY });
		const session = await client.sessions.verifyToken(token);
		
		return {
			userId: session.userId,
			sessionClaims: session.claims as {
				admin?: boolean;
				[key: string]: unknown;
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Clerk token verification failed: ${errorMessage}`);
	}
}

/**
 * Check if user has required auth level
 */
export function checkAuthLevel(
	authType: "requireUser" | "requireAuth" | "requireAdmin" | "none",
	sessionClaims?: { admin?: boolean }
): boolean {
	switch (authType) {
		case "none":
			return true;
		case "requireAuth":
			return true; // Basic auth check passed
		case "requireUser":
			return true; // User auth check passed
		case "requireAdmin":
			return sessionClaims?.admin === true;
		default:
			return false;
	}
}
