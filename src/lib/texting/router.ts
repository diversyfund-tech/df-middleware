import { syncTextingMessageToGHL } from "@/lib/sync/texting-to-ghl";
import { syncTextingMessageToAloware } from "@/lib/sync/texting-to-aloware";
import { db } from "@/server/db";
import { optoutRegistry, syncLog } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { addTagsToContact, getOrCreateContact } from "@/lib/ghl/client";
import { env } from "@/env";
import type { TextingWebhookPayload } from "./types";

/**
 * Route texting webhook event to appropriate sync handlers
 */
export async function routeTextingEvent(
	payload: TextingWebhookPayload,
	correlationId: string
): Promise<void> {
	if (payload.eventType === "message.received" || payload.eventType === "message.sent") {
		// Sync to GHL
		await syncTextingMessageToGHL(payload, { correlationId });

		// Optionally sync to Aloware if enabled
		if (env.TEXTING_SYNC_TO_ALOWARE === "true") {
			await syncTextingMessageToAloware(payload, { correlationId });
		}
	} else if (payload.eventType === "optout.stop") {
		// Handle opt-out
		const phone = payload.from || payload.to;
		if (phone) {
			// Update opt-out registry
			await db
				.insert(optoutRegistry)
				.values({
					phoneNumber: phone,
					status: "opted_out",
					source: "texting",
					reason: "STOP",
					lastEventAt: new Date(),
				})
				.onConflictDoUpdate({
					target: optoutRegistry.phoneNumber,
					set: {
						status: "opted_out",
						reason: "STOP",
						lastEventAt: new Date(),
						updatedAt: new Date(),
					},
				});

			// Tag GHL contact
			const ghlContactId = await getOrCreateContact(undefined, phone);
			await addTagsToContact(ghlContactId, ["DNC-SMS", "SMS Opted Out"]);

			// Log
			await db.insert(syncLog).values({
				direction: "texting_to_ghl",
				entityType: "optout",
				entityId: payload.messageId || "unknown",
				sourceId: payload.messageId || "unknown",
				targetId: ghlContactId,
				status: "success",
				finishedAt: new Date(),
				correlationId,
			});
		}
	} else {
		// Unknown event type - log but don't error
		console.warn(`[texting/router] Unknown event type: ${payload.eventType}`);
	}
}

