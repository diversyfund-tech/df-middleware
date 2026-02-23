#!/usr/bin/env tsx
/**
 * Process Today's Events Script
 * Processes all pending webhook events from today only
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables FIRST before importing db
config({ path: resolve(__dirname, "../.env.local") });

import { routeWebhookEvent } from "@/lib/events/router";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { eq, and, gte } from "drizzle-orm";

const BATCH_SIZE = 100;

async function processTodayEvents() {
	console.log("🚀 Processing today's pending events...\n");

	// Get start of today (UTC)
	const todayStart = new Date();
	todayStart.setUTCHours(0, 0, 0, 0);

	console.log(`📅 Processing events from: ${todayStart.toISOString()} onwards\n`);

	let totalProcessed = 0;
	let totalErrors = 0;
	let iteration = 0;
	const MAX_ITERATIONS = 1000; // Safety limit

	while (iteration < MAX_ITERATIONS) {
		iteration++;

		// Get pending events from today
		const pendingEvents = await db
			.select()
			.from(webhookEvents)
			.where(
				and(
					eq(webhookEvents.status, "pending"),
					gte(webhookEvents.receivedAt, todayStart)
				)
			)
			.limit(BATCH_SIZE)
			.orderBy(webhookEvents.receivedAt); // Process oldest first

		if (pendingEvents.length === 0) {
			console.log("\n✅ No more pending events from today!");
			break;
		}

		console.log(`📦 Processing batch ${iteration} (${pendingEvents.length} events)...`);

		let batchProcessed = 0;
		let batchErrors = 0;

		for (const event of pendingEvents) {
			try {
				// Atomically update status to processing
				const updated = await db
					.update(webhookEvents)
					.set({ status: "processing" })
					.where(
						and(
							eq(webhookEvents.id, event.id),
							eq(webhookEvents.status, "pending")
						)
					)
					.returning();

				if (updated.length === 0) {
					// Already claimed by another process, skip
					continue;
				}

				// Process the event
				await routeWebhookEvent(event);

				// Mark as done
				await db
					.update(webhookEvents)
					.set({
						status: "done",
						processedAt: new Date(),
					})
					.where(eq(webhookEvents.id, event.id));

				batchProcessed++;
				totalProcessed++;

				// Progress indicator
				if (batchProcessed % 10 === 0) {
					process.stdout.write(".");
				}
			} catch (error) {
				console.error(`\n❌ Error processing event ${event.id}:`, error);
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				await db
					.update(webhookEvents)
					.set({
						status: "error",
						errorMessage,
						processedAt: new Date(),
					})
					.where(eq(webhookEvents.id, event.id));
				batchErrors++;
				totalErrors++;
			}
		}

		console.log(`\n   ✓ Processed: ${batchProcessed}, Errors: ${batchErrors}`);

		// Check remaining count for today
		const remaining = await db
			.select({ count: webhookEvents.id })
			.from(webhookEvents)
			.where(
				and(
					eq(webhookEvents.status, "pending"),
					gte(webhookEvents.receivedAt, todayStart)
				)
			);

		const remainingCount = remaining.length;
		console.log(`   📊 Remaining today: ${remainingCount} events`);

		if (remainingCount === 0) {
			console.log("\n✅ All today's events processed!");
			break;
		}

		// Small delay to avoid overwhelming the database
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	console.log("\n" + "=".repeat(80));
	console.log("📊 FINAL RESULTS");
	console.log("=".repeat(80));
	console.log(`Total Processed: ${totalProcessed}`);
	console.log(`Total Errors: ${totalErrors}`);
	console.log(`Iterations: ${iteration}`);
	console.log("=".repeat(80) + "\n");

	await db.$client.end();
}

// Run processing
processTodayEvents().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
