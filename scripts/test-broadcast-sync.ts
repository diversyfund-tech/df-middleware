#!/usr/bin/env tsx

/**
 * Test Broadcast Analytics Sync
 * 
 * Tests the broadcast analytics sync flow:
 * 1. Receives webhook from Verity (simulated)
 * 2. Calculates analytics from Verity DB
 * 3. Syncs to GHL Custom Objects
 * 
 * Usage: pnpm tsx scripts/test-broadcast-sync.ts <broadcastId>
 */

import { db } from "../src/server/db";
import { broadcastWebhookEvents } from "../src/server/db/schema";
import { routeBroadcastEvent } from "../src/lib/broadcasts/router";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";

async function testBroadcastSync(broadcastId: string) {
	console.log(`\n🧪 Testing broadcast sync for: ${broadcastId}`);
	console.log("=".repeat(80));

	try {
		// Create a test webhook event
		const timestamp = new Date().toISOString();
		const dedupeKey = createHash("sha256")
			.update(`broadcast:${broadcastId}:analytics_updated:test:${timestamp}`)
			.digest("hex")
			.substring(0, 16);

		console.log("\n1️⃣ Creating test webhook event...");
		const [event] = await db
			.insert(broadcastWebhookEvents)
			.values({
				broadcastId,
				eventType: "analytics_updated",
				payloadJson: {
					test: true,
					timestamp,
				},
				dedupeKey: `broadcast:${broadcastId}:analytics_updated:test:${dedupeKey}`,
				status: "pending",
			})
			.returning();

		if (!event) {
			throw new Error("Failed to create test event");
		}

		console.log(`   ✅ Created event: ${event.id}`);

		console.log("\n2️⃣ Calculating analytics from Verity DB...");
		console.log("   (This queries Verity's database directly)");

		console.log("\n3️⃣ Syncing to GHL Custom Objects...");
		console.log("   (This creates/updates the Broadcast custom object in GHL)");

		// Process the event
		await routeBroadcastEvent(event);

		console.log("\n✅ Successfully synced broadcast analytics to GHL!");
		console.log("\n📊 Check GHL Custom Objects to verify the sync.");

		// Clean up test event
		await db
			.delete(broadcastWebhookEvents)
			.where(eq(broadcastWebhookEvents.id, event.id));

		console.log("\n🧹 Cleaned up test event");
	} catch (error) {
		console.error("\n❌ Error:", error);
		if (error instanceof Error) {
			console.error("   Message:", error.message);
			console.error("   Stack:", error.stack);
		}
		process.exit(1);
	}
}

// Get broadcast ID from command line
const broadcastId = process.argv[2];

if (!broadcastId) {
	console.error("Usage: pnpm tsx scripts/test-broadcast-sync.ts <broadcastId>");
	process.exit(1);
}

testBroadcastSync(broadcastId)
	.then(() => {
		console.log("\n✅ Test completed!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\n❌ Test failed:", error);
		process.exit(1);
	});

