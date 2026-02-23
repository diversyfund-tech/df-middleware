/**
 * Check Recent Webhook Events
 * 
 * Shows recent webhook events from the database to verify they're being stored correctly
 */

import { db } from "../src/server/db";
import { webhookEvents } from "../src/server/db/schema";
import { desc, eq } from "drizzle-orm";

async function checkRecentWebhooks() {
	console.log("\n=== Recent GHL Webhook Events ===\n");

	try {
		// Get last 20 webhook events
		const recentEvents = await db
			.select()
			.from(webhookEvents)
			.where(eq(webhookEvents.source, "ghl"))
			.orderBy(desc(webhookEvents.receivedAt))
			.limit(20);

		if (recentEvents.length === 0) {
			console.log("No GHL webhook events found in database.\n");
			return;
		}

		console.log(`Found ${recentEvents.length} recent GHL webhook events:\n`);

		for (const event of recentEvents) {
			const receivedAt = event.receivedAt instanceof Date
				? event.receivedAt.toISOString()
				: new Date(event.receivedAt).toISOString();

			const processedAt = event.processedAt
				? (event.processedAt instanceof Date
					? event.processedAt.toISOString()
					: new Date(event.processedAt).toISOString())
				: "Not processed";

			const statusIcon = event.status === "done" ? "✅" :
			                   event.status === "pending" ? "⏳" :
			                   event.status === "processing" ? "🔄" :
			                   event.status === "error" ? "❌" : "❓";

			console.log(`${statusIcon} ${event.eventType} (${event.entityType})`);
			console.log(`   ID: ${event.id}`);
			console.log(`   Entity ID: ${event.entityId}`);
			console.log(`   Status: ${event.status}`);
			console.log(`   Received: ${receivedAt}`);
			console.log(`   Processed: ${processedAt}`);
			console.log(`   Dedupe Key: ${event.dedupeKey}`);
			if (event.errorMessage) {
				console.log(`   Error: ${event.errorMessage}`);
			}
			console.log("");
		}

		// Summary
		const statusCounts = recentEvents.reduce((acc, event) => {
			acc[event.status] = (acc[event.status] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		console.log("=== Summary ===");
		for (const [status, count] of Object.entries(statusCounts)) {
			console.log(`${status}: ${count}`);
		}

		// Check for the specific contact from logs
		const contactId = "ldErVVX2S2v8Vk5gvHME";
		const contactEvents = recentEvents.filter(e => e.entityId === contactId);
		
		if (contactEvents.length > 0) {
			console.log(`\n=== Events for Contact ${contactId} ===");
			for (const event of contactEvents) {
				console.log(`- ${event.eventType} at ${event.receivedAt} (Status: ${event.status})`);
			}
		}

	} catch (error) {
		console.error("Error checking webhook events:", error);
		throw error;
	}
}

// Run if executed directly
if (require.main === module) {
	checkRecentWebhooks()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n=== ERROR ===");
			console.error(error);
			process.exit(1);
		});
}

export { checkRecentWebhooks };
