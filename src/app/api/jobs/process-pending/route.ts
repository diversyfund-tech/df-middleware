import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { routeWebhookEvent } from "@/lib/events/router";
import { logger } from "@/lib/logger";
import { updateJobQueueMetrics, recordJobProcessingDuration, recordJobFailure } from "@/lib/jobs/metrics";
import { webhookEventsProcessedTotal } from "@/lib/metrics";
import { WEBHOOK_SOURCES, JOB_QUEUE_NAMES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

/**
 * Process pending webhook events (called by Vercel Cron)
 * This is a fallback for when the dedicated worker isn't running
 * 
 * GET /api/jobs/process-pending (called by Vercel Cron)
 */
export async function GET(req: NextRequest) {
	// Verify this is called by Vercel Cron (optional security check)
	const authHeader = req.headers.get("authorization");
	const cronSecret = env.X_DF_JOBS_SECRET;
	
	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		// Allow Vercel Cron to call without auth, but require auth for manual calls
		const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
		if (!isVercelCron) {
			return new NextResponse("Unauthorized", { status: 401 });
		}
	}

	try {
		const batchSize = 100; // Process larger batches in cron job (increased from 10)
		const startTime = Date.now();

		logger.info({ batchSize }, "Starting job processing");

		// Update queue metrics
		await updateJobQueueMetrics();

		// Get pending events
		const pendingEvents = await db
			.select()
			.from(webhookEvents)
			.where(eq(webhookEvents.status, "pending"))
			.limit(batchSize);

		if (pendingEvents.length === 0) {
			logger.info({}, "No pending events to process");
			return NextResponse.json({
				processed: 0,
				message: "No pending events",
			});
		}

		logger.info({ count: pendingEvents.length }, "Found pending events to process");

		// Process events directly (since we're in a cron job context)
		// This provides immediate processing without requiring a dedicated worker
		let processed = 0;
		let errors = 0;

		for (const event of pendingEvents) {
			const eventStartTime = Date.now();
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

				const eventDuration = (Date.now() - eventStartTime) / 1000;
				recordJobProcessingDuration(JOB_QUEUE_NAMES.WEBHOOK_EVENT, eventDuration);
				webhookEventsProcessedTotal.inc({ source: event.source as keyof typeof WEBHOOK_SOURCES, status: "success" });

				processed++;
			} catch (error) {
				const eventDuration = (Date.now() - eventStartTime) / 1000;
				recordJobFailure(JOB_QUEUE_NAMES.WEBHOOK_EVENT);
				webhookEventsProcessedTotal.inc({ source: event.source as keyof typeof WEBHOOK_SOURCES, status: "error" });

				logger.error({ eventId: event.id, error }, "Error processing event");
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				await db
					.update(webhookEvents)
					.set({
						status: "error",
						errorMessage,
						processedAt: new Date(),
					})
					.where(eq(webhookEvents.id, event.id));
				errors++;
			}
		}

		const totalDuration = (Date.now() - startTime) / 1000;
		logger.info({
			processed,
			errors,
			totalPending: pendingEvents.length,
			duration: totalDuration,
		}, "Job processing completed");

		return NextResponse.json({
			processed,
			errors,
			totalPending: pendingEvents.length,
		});
	} catch (error) {
		logger.error({ error }, "Error in process-pending job");
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

