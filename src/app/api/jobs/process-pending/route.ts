import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { routeWebhookEvent } from "@/lib/events/router";

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
		const batchSize = 10; // Process smaller batches in cron job

		// Get pending events
		const pendingEvents = await db
			.select()
			.from(webhookEvents)
			.where(eq(webhookEvents.status, "pending"))
			.limit(batchSize);

		if (pendingEvents.length === 0) {
			return NextResponse.json({
				processed: 0,
				message: "No pending events",
			});
		}

		// Process events directly (since we're in a cron job context)
		// This provides immediate processing without requiring a dedicated worker
		let processed = 0;
		let errors = 0;

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

				processed++;
			} catch (error) {
				console.error(`[process-pending] Error processing event ${event.id}:`, error);
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

		return NextResponse.json({
			processed,
			errors,
			totalPending: pendingEvents.length,
		});
	} catch (error) {
		console.error("[process-pending] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

