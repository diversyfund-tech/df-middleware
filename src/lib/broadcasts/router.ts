/**
 * Broadcast Event Router
 * 
 * Routes broadcast webhook events to analytics calculation and GHL sync.
 */

import { db } from "@/server/db";
import { broadcastWebhookEvents, syncLog } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { calculateBroadcastAnalytics } from "./calculate-analytics";
import { syncBroadcastAnalyticsToGHL } from "./sync-to-ghl";

type BroadcastWebhookEvent = typeof broadcastWebhookEvents.$inferSelect;

/**
 * Route broadcast event to analytics calculation and GHL sync
 */
export async function routeBroadcastEvent(event: BroadcastWebhookEvent): Promise<void> {
	const correlationId = event.id;
	const broadcastId = event.broadcastId;

	console.log(`[broadcast/router] Processing broadcast event ${event.id} for broadcast ${broadcastId}`);

	try {
		// Calculate analytics by querying Verity DB
		const analytics = await calculateBroadcastAnalytics(broadcastId);

		// Sync to GHL Custom Objects
		await syncBroadcastAnalyticsToGHL(broadcastId, analytics);

		// Log success
		await db.insert(syncLog).values({
			direction: "texting_to_ghl",
			entityType: "broadcast",
			entityId: broadcastId,
			sourceId: broadcastId,
			targetId: broadcastId, // GHL custom object ID (same as broadcast ID for tracking)
			status: "success",
			finishedAt: new Date(),
			correlationId,
		});

		console.log(`[broadcast/router] Successfully processed broadcast event ${event.id}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[broadcast/router] Error processing broadcast event ${event.id}:`, error);

		// Log error
		await db.insert(syncLog).values({
			direction: "texting_to_ghl",
			entityType: "broadcast",
			entityId: broadcastId,
			sourceId: broadcastId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}


