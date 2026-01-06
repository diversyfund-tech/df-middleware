#!/usr/bin/env node

import { startBoss, stopBoss, WEBHOOK_EVENT_QUEUE, BROADCAST_EVENT_QUEUE, getBoss } from "@/lib/jobs/boss";
import { db } from "@/server/db";
import { webhookEvents, quarantineEvents, broadcastWebhookEvents } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { routeWebhookEvent } from "@/lib/events/router";
import { processTextingEvent } from "@/lib/texting/jobs";
import { routeBroadcastEvent } from "@/lib/broadcasts/router";

/**
 * Worker process for processing webhook events
 * 
 * Usage: pnpm run worker
 */

let isShuttingDown = false;

/**
 * Process a single webhook event job
 */
async function processWebhookEvent(job: { id: string; data: { webhookEventId: string } } | { id: string; data: { webhookEventId: string } }[]) {
	// Handle both single job and array of jobs
	const jobs = Array.isArray(job) ? job : [job];
	
	for (const singleJob of jobs) {
		const { webhookEventId } = singleJob.data;

		try {
		// Load the webhook event
		const event = await db.query.webhookEvents.findFirst({
			where: eq(webhookEvents.id, webhookEventId),
		});

		if (!event) {
			console.warn(`[worker] Webhook event ${webhookEventId} not found`);
			return;
		}

		// Check if already processed
		if (event.status !== "pending") {
			console.log(`[worker] Event ${webhookEventId} already processed (status: ${event.status})`);
			return;
		}

		// Check if quarantined
		const quarantined = await db.query.quarantineEvents.findFirst({
			where: and(
				eq(quarantineEvents.eventId, webhookEventId),
				eq(quarantineEvents.eventSource, "webhook")
			),
		});

		if (quarantined) {
			console.log(`[worker] Event ${webhookEventId} is quarantined, skipping`);
			// Mark as done without processing
			await db
				.update(webhookEvents)
				.set({
					status: "done",
					processedAt: new Date(),
					errorMessage: "quarantined",
				})
				.where(eq(webhookEvents.id, webhookEventId));
			return;
		}

		// Atomically update status to processing (only if still pending)
		const updated = await db
			.update(webhookEvents)
			.set({ status: "processing" })
			.where(eq(webhookEvents.id, webhookEventId))
			.returning();

		if (updated.length === 0 || updated[0].status !== "processing") {
			// Another worker already claimed it
			console.log(`[worker] Event ${webhookEventId} already claimed by another worker`);
			return;
		}

		console.log(`[worker] Processing event ${webhookEventId} (${event.source}:${event.entityType}:${event.entityId})`);

		// Route and process the event
		await routeWebhookEvent(event);

		// Mark as done
		await db
			.update(webhookEvents)
			.set({
				status: "done",
				processedAt: new Date(),
			})
			.where(eq(webhookEvents.id, webhookEventId));

		console.log(`[worker] Successfully processed event ${webhookEventId}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[worker] Error processing event ${webhookEventId}:`, error);

		// Mark as error
		try {
			await db
				.update(webhookEvents)
				.set({
					status: "error",
					errorMessage,
					processedAt: new Date(),
				})
				.where(eq(webhookEvents.id, webhookEventId));
		} catch (updateError) {
			console.error(`[worker] Failed to update error status for ${webhookEventId}:`, updateError);
		}

		// Re-throw to trigger pg-boss retry logic
		throw error;
		}
	}
}

/**
 * Process a single broadcast event job
 */
async function processBroadcastEvent(job: { id: string; data: { broadcastEventId: string } } | { id: string; data: { broadcastEventId: string } }[]) {
	// Handle both single job and array of jobs
	const jobs = Array.isArray(job) ? job : [job];
	
	for (const singleJob of jobs) {
		const { broadcastEventId } = singleJob.data;

		try {
			// Load the broadcast webhook event
			const event = await db.query.broadcastWebhookEvents.findFirst({
				where: eq(broadcastWebhookEvents.id, broadcastEventId),
			});

			if (!event) {
				console.warn(`[worker] Broadcast event ${broadcastEventId} not found`);
				return;
			}

			// Check if already processed
			if (event.status !== "pending") {
				console.log(`[worker] Broadcast event ${broadcastEventId} already processed (status: ${event.status})`);
				return;
			}

			// Atomically update status to processing (only if still pending)
			const updated = await db
				.update(broadcastWebhookEvents)
				.set({ status: "processing" })
				.where(eq(broadcastWebhookEvents.id, broadcastEventId))
				.returning();

			if (updated.length === 0 || updated[0].status !== "processing") {
				// Another worker already claimed it
				console.log(`[worker] Broadcast event ${broadcastEventId} already claimed by another worker`);
				return;
			}

			console.log(`[worker] Processing broadcast event ${broadcastEventId} (broadcast: ${event.broadcastId}, type: ${event.eventType})`);

			// Route and process the event
			await routeBroadcastEvent(event);

			// Mark as done
			await db
				.update(broadcastWebhookEvents)
				.set({
					status: "done",
					processedAt: new Date(),
				})
				.where(eq(broadcastWebhookEvents.id, broadcastEventId));

			console.log(`[worker] Successfully processed broadcast event ${broadcastEventId}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error(`[worker] Error processing broadcast event ${broadcastEventId}:`, error);

			// Mark as error
			try {
				await db
					.update(broadcastWebhookEvents)
					.set({
						status: "error",
						errorMessage,
						processedAt: new Date(),
					})
					.where(eq(broadcastWebhookEvents.id, broadcastEventId));
			} catch (updateError) {
				console.error(`[worker] Failed to update error status for ${broadcastEventId}:`, updateError);
			}

			// Re-throw to trigger pg-boss retry logic
			throw error;
		}
	}
}

/**
 * Start the worker
 */
async function startWorker() {
	console.log("[worker] Starting webhook event worker...");

	try {
		// Start pg-boss
		await startBoss();
		const boss = getBoss();

		// Register handler for webhook events
		await boss.work(WEBHOOK_EVENT_QUEUE, processWebhookEvent);

		// Register handler for texting events
		await boss.work("process-texting-event", processTextingEvent);

		// Register handler for broadcast events
		await boss.work(BROADCAST_EVENT_QUEUE, processBroadcastEvent);

		console.log("[worker] Worker started successfully. Listening for jobs...");

		// Handle graceful shutdown
		process.on("SIGTERM", handleShutdown);
		process.on("SIGINT", handleShutdown);
	} catch (error) {
		console.error("[worker] Failed to start worker:", error);
		process.exit(1);
	}
}

/**
 * Handle graceful shutdown
 */
async function handleShutdown() {
	if (isShuttingDown) {
		return;
	}
	isShuttingDown = true;

	console.log("[worker] Shutting down worker...");

	try {
		await stopBoss();
		console.log("[worker] Worker stopped successfully");
		process.exit(0);
	} catch (error) {
		console.error("[worker] Error during shutdown:", error);
		process.exit(1);
	}
}

// Start the worker
startWorker().catch((error) => {
	console.error("[worker] Fatal error:", error);
	process.exit(1);
});

