import { db } from "@/server/db";
import { textingWebhookEvents, quarantineEvents } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { routeTextingEvent } from "./router";
import { normalizeTextingWebhook } from "./normalize";

/**
 * Process a single texting webhook event job
 */
export async function processTextingEvent(job: { id: string; data: { textingEventId: string } } | { id: string; data: { textingEventId: string } }[]) {
	// Handle both single job and array of jobs
	const jobs = Array.isArray(job) ? job : [job];
	
	for (const singleJob of jobs) {
		const { textingEventId } = singleJob.data;

		try {
		// Load the texting webhook event
		const event = await db.query.textingWebhookEvents.findFirst({
			where: eq(textingWebhookEvents.id, textingEventId),
		});

		if (!event) {
			console.warn(`[texting/jobs] Texting event ${textingEventId} not found`);
			return;
		}

		// Check if already processed
		if (event.status !== "pending") {
			console.log(`[texting/jobs] Event ${textingEventId} already processed (status: ${event.status})`);
			return;
		}

		// Check if quarantined
		const quarantined = await db.query.quarantineEvents.findFirst({
			where: and(
				eq(quarantineEvents.eventId, textingEventId),
				eq(quarantineEvents.eventSource, "texting")
			),
		});

		if (quarantined) {
			console.log(`[texting/jobs] Event ${textingEventId} is quarantined, skipping`);
			// Mark as done without processing
			await db
				.update(textingWebhookEvents)
				.set({
					status: "done",
					processedAt: new Date(),
					errorMessage: "quarantined",
				})
				.where(eq(textingWebhookEvents.id, textingEventId));
			return;
		}

		// Atomically update status to processing (only if still pending)
		const updated = await db
			.update(textingWebhookEvents)
			.set({ status: "processing" })
			.where(eq(textingWebhookEvents.id, textingEventId))
			.returning();

		if (updated.length === 0 || updated[0].status !== "processing") {
			// Another worker already claimed it
			console.log(`[texting/jobs] Event ${textingEventId} already claimed by another worker`);
			return;
		}

		console.log(`[texting/jobs] Processing event ${textingEventId} (${event.eventType})`);

		// Normalize payload (it's stored as raw JSON)
		const payload = normalizeTextingWebhook(event.payloadJson);

		// Route and process the event
		await routeTextingEvent(payload, event.id);

		// Mark as done
		await db
			.update(textingWebhookEvents)
			.set({
				status: "done",
				processedAt: new Date(),
			})
			.where(eq(textingWebhookEvents.id, textingEventId));

		console.log(`[texting/jobs] Successfully processed event ${textingEventId}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[texting/jobs] Error processing event ${textingEventId}:`, error);

		// Mark as error
		try {
			await db
				.update(textingWebhookEvents)
				.set({
					status: "error",
					errorMessage,
					processedAt: new Date(),
				})
				.where(eq(textingWebhookEvents.id, textingEventId));
		} catch (updateError) {
			console.error(`[texting/jobs] Failed to update error status for ${textingEventId}:`, updateError);
		}

		// Re-throw to trigger pg-boss retry logic
		throw error;
		}
	}
}

