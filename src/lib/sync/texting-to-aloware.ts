import { db } from "@/server/db";
import { contactMappings, messageMappings, syncLog } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { searchContacts } from "@/lib/aloware/client";
import type { TextingWebhookPayload } from "@/lib/texting/types";

/**
 * Sync texting message to Aloware (skeleton implementation)
 * Currently limited - Aloware may not have message/activity API
 */
export async function syncTextingMessageToAloware(
	payload: TextingWebhookPayload,
	opts?: { correlationId?: string }
): Promise<void> {
	const correlationId = opts?.correlationId || `texting-sync-aloware-${Date.now()}`;
	const messageId = payload.messageId || "unknown";

	try {
		// Determine phone number
		const phone = payload.direction === "inbound" ? payload.from : payload.to;
		if (!phone) {
			throw new Error("No phone number in payload");
		}

		// Find contact mapping
		const existingMapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.phoneNumber, phone),
		});

		let alowareContactId: string | null = null;

		if (existingMapping) {
			alowareContactId = existingMapping.alowareContactId;
		} else {
			// Try to find in Aloware
			const contacts = await searchContacts(phone);
			if (contacts.length > 0) {
				alowareContactId = contacts[0].id;
				// Create mapping if we have GHL contact
				const ghlMapping = await db.query.contactMappings.findFirst({
					where: eq(contactMappings.phoneNumber, phone),
				});
				if (ghlMapping) {
					await db
						.update(contactMappings)
						.set({ alowareContactId })
						.where(eq(contactMappings.id, ghlMapping.id));
				}
			}
		}

		// Store message mapping
		if (alowareContactId) {
			await db
				.insert(messageMappings)
				.values({
					textingMessageId: payload.messageId || null,
					alowareContactId,
					conversationId: payload.conversationId || null,
					fromNumber: payload.from || null,
					toNumber: payload.to || null,
					direction: payload.direction || null,
				})
				.onConflictDoNothing();
		}

		// Log (marking as not-supported since Aloware may not have message API)
		await db.insert(syncLog).values({
			direction: "texting_to_aloware",
			entityType: "message",
			entityId: messageId,
			sourceId: messageId,
			targetId: alowareContactId || undefined,
			status: alowareContactId ? "success" : "error",
			finishedAt: new Date(),
			errorMessage: alowareContactId ? "not-supported" : "no-aloware-contact",
			correlationId,
		});
	} catch (error) {
		console.error("[texting-to-aloware] Error syncing message:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Log error
		await db.insert(syncLog).values({
			direction: "texting_to_aloware",
			entityType: "message",
			entityId: messageId,
			sourceId: messageId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

