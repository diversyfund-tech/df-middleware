/**
 * Job queue metrics helpers
 * 
 * Functions to update job queue metrics
 */

import { jobQueueDepth, jobProcessingDuration, jobFailuresTotal } from "@/lib/metrics";
import { JOB_QUEUE_NAMES } from "@/lib/constants";
import { db } from "@/server/db";
import { webhookEvents, broadcastWebhookEvents } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Update job queue depth metrics
 */
export async function updateJobQueueMetrics(): Promise<void> {
	try {
		// Get pending webhook events count
		const pendingWebhooks = await db
			.select()
			.from(webhookEvents)
			.where(eq(webhookEvents.status, "pending"));

		jobQueueDepth.set({ queue_name: JOB_QUEUE_NAMES.WEBHOOK_EVENT }, pendingWebhooks.length);

		// Get pending broadcast events count
		const pendingBroadcasts = await db
			.select()
			.from(broadcastWebhookEvents)
			.where(eq(broadcastWebhookEvents.status, "pending"));

		jobQueueDepth.set({ queue_name: JOB_QUEUE_NAMES.BROADCAST_EVENT }, pendingBroadcasts.length);
	} catch (error) {
		// Don't throw - metrics update failures shouldn't break the app
		console.error("[metrics] Error updating job queue metrics:", error);
	}
}

/**
 * Record job processing duration
 */
export function recordJobProcessingDuration(queueName: string, duration: number): void {
	jobProcessingDuration.observe({ queue_name: queueName }, duration);
}

/**
 * Record job failure
 */
export function recordJobFailure(queueName: string): void {
	jobFailuresTotal.inc({ queue_name: queueName });
}
