#!/usr/bin/env bun
/**
 * Test script to initiate an AI call using Clerk authentication
 * 
 * This script:
 * 1. Gets a Clerk session token using the backend SDK
 * 2. Uses that token to call the Verity API
 */

import { createClerkClient } from "@clerk/backend";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "sk_test_bK2Mt5naoQmZp07f869F7GXkRAYvWOPG8kA7JWDY33";
const VERITY_BASE_URL = process.env.VERITY_BASE_URL || "http://localhost:3000";
const AGENT_ID = process.env.AGENT_ID || "agent_3901kffpqtbge0ev6cve7fgcvbkg";
const PHONE_NUMBER = process.env.PHONE_NUMBER || "+19492459055";

async function main() {
	console.log("🔧 Getting Clerk client...");
	const client = createClerkClient({ secretKey: CLERK_SECRET_KEY });

	console.log("👥 Listing users to find a test user...");
	const users = await client.users.getUserList({ limit: 1 });
	
	if (users.data.length === 0) {
		console.error("❌ No users found in Clerk");
		process.exit(1);
	}

	const userId = users.data[0].id;
	console.log(`✅ Found user: ${userId}`);

	console.log("🔑 Getting user sessions...");
	// Get existing sessions for the user
	const sessions = await client.sessions.getSessionList({ userId });
	
	if (sessions.data.length === 0) {
		console.error("❌ No sessions found for user. User needs to sign in first.");
		process.exit(1);
	}

	const session = sessions.data[0];
	console.log(`✅ Found session: ${session.id}`);

	console.log("🔑 Creating session token via Clerk API...");
	// Use Clerk API directly to create a session token
	const clerkApiUrl = `https://api.clerk.com/v1/sessions/${session.id}/tokens`;
	const tokenResponse = await fetch(clerkApiUrl, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${CLERK_SECRET_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			expires_in_seconds: 3600,
		}),
	});

	if (!tokenResponse.ok) {
		const errorText = await tokenResponse.text();
		throw new Error(`Failed to create session token: ${tokenResponse.status} ${errorText}`);
	}

	const tokenData = await tokenResponse.json();
	const jwt = tokenData.jwt || tokenData.token;

	if (!jwt) {
		throw new Error("No JWT token in response");
	}

	console.log(`✅ Session token created: ${jwt.substring(0, 50)}...`);

	console.log(`📞 Initiating call to ${PHONE_NUMBER} using agent ${AGENT_ID}...`);
	
	const response = await fetch(`${VERITY_BASE_URL}/api/calls/agents/${AGENT_ID}/test`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${jwt}`,
		},
		body: JSON.stringify({
			to: PHONE_NUMBER,
		}),
	});

	let data;
	try {
		data = await response.json();
	} catch (e) {
		const text = await response.text();
		console.error(`❌ Response not JSON. Status: ${response.status}`);
		console.error(`Response body: ${text.substring(0, 500)}`);
		process.exit(1);
	}

	if (!response.ok) {
		console.error(`❌ Call failed with status ${response.status}:`, data);
		process.exit(1);
	}

	console.log("✅ Call initiated successfully!");
	console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
	console.error("❌ Error:", error);
	process.exit(1);
});
