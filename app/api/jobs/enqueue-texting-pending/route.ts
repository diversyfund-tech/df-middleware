import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { textingWebhookEvents } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { startBoss } from "@/lib/jobs/boss";

export const dynamic = "force-dynamic";

/**
 * Validate jobs secret header
 */
function validateJobsSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-JOBS-SECRET");
	return secret === env.X_DF_JOBS_SECRET;
}

/**
 * Enqueue pending texting webhook events for processing
 * POST /api/jobs/enqueue-texting-pending
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
			.from(textingWebhookEvents)
			.where(eq(textingWebhookEvents.status, "pending"))
			.limit(batchSize);

		if (pendingEvents.length === 0) {
			return NextResponse.json({
				enqueued: 0,
				totalPending: 0,
			});
		}

		// Initialize boss and enqueue jobs
		const boss = await startBoss();
		let enqueued = 0;

		for (const event of pendingEvents) {
			try {
				await boss.send("process-texting-event", {
					textingEventId: event.id,
				});
				enqueued++;
			} catch (error) {
				console.error(`[enqueue-texting-pending] Failed to enqueue event ${event.id}:`, error);
			}
		}

		// Get total pending count
		const totalPendingResult = await db
			.select()
			.from(textingWebhookEvents)
			.where(eq(textingWebhookEvents.status, "pending"));

		return NextResponse.json({
			enqueued,
			totalPending: totalPendingResult.length,
		});
	} catch (error) {
		console.error("[enqueue-texting-pending] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

