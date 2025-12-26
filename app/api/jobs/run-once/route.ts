import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { routeWebhookEvent } from "@/lib/events/router";

export const dynamic = "force-dynamic";

/**
 * Validate jobs secret header
 */
function validateJobsSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-JOBS-SECRET");
	return secret === env.X_DF_JOBS_SECRET;
}

/**
 * Process pending webhook events immediately (for dev/testing)
 * POST /api/jobs/run-once
 */
export async function POST(req: NextRequest) {
	if (!validateJobsSecret(req)) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		const batchSize = env.JOBS_BATCH_SIZE 
			? parseInt(env.JOBS_BATCH_SIZE, 10) 
			: 100;

		// Get pending events
		const pendingEvents = await db
			.select()
			.from(webhookEvents)
			.where(eq(webhookEvents.status, "pending"))
			.limit(batchSize);

		if (pendingEvents.length === 0) {
			return NextResponse.json({
				processed: 0,
				totalPending: 0,
			});
		}

		let processed = 0;
		let errors = 0;

		// Process sequentially
		for (const event of pendingEvents) {
			try {
				// Atomically update status to processing
				const updated = await db
					.update(webhookEvents)
					.set({ status: "processing" })
					.where(eq(webhookEvents.id, event.id))
					.returning();

				if (updated.length === 0 || updated[0].status !== "processing") {
					// Another worker already claimed it
					continue;
				}

				// Route and process
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
				errors++;
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				
				// Mark as error
				await db
					.update(webhookEvents)
					.set({
						status: "error",
						errorMessage,
						processedAt: new Date(),
					})
					.where(eq(webhookEvents.id, event.id));

				console.error(`[run-once] Error processing event ${event.id}:`, error);
			}
		}

		// Get total pending count
		const totalPendingResult = await db
			.select()
			.from(webhookEvents)
			.where(eq(webhookEvents.status, "pending"));

		return NextResponse.json({
			processed,
			errors,
			totalPending: totalPendingResult.length,
		});
	} catch (error) {
		console.error("[run-once] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

