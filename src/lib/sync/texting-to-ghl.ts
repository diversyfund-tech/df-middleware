import { db } from "@/server/db";
import { contactMappings, messageMappings, syncLog, optoutRegistry } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateContact, addTagsToContact } from "@/lib/ghl/client";
import { addInboundMessage, sendOutboundMessage } from "@/lib/ghl/conversations";
import { isStop } from "@/lib/compliance/smsOptOut";
import type { TextingWebhookPayload } from "@/lib/texting/types";

/**
 * Sync texting message to GHL
 * Creates/updates GHL contact and appends message as note
 */
export async function syncTextingMessageToGHL(
	payload: TextingWebhookPayload,
	opts?: { correlationId?: string }
): Promise<void> {
	const correlationId = opts?.correlationId || `texting-sync-${Date.now()}`;
	const messageId = payload.messageId || "unknown";

	try {
		// Determine phone number (from for inbound, to for outbound)
		const phone = payload.direction === "inbound" ? payload.from : payload.to;
		if (!phone) {
			throw new Error("No phone number in payload");
		}

		// Handle STOP opt-out
		if (payload.direction === "inbound" && payload.body && isStop(payload.body)) {
			// Write to opt-out registry
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

			// Find/create contact and tag as DNC
			const ghlContactId = await getOrCreateContact(undefined, phone);
			await addTagsToContact(ghlContactId, ["DNC-SMS", "SMS Opted Out"]);

			// Log opt-out
			await db.insert(syncLog).values({
				direction: "texting_to_ghl",
				entityType: "optout",
				entityId: messageId,
				sourceId: messageId,
				targetId: ghlContactId,
				status: "success",
				finishedAt: new Date(),
				correlationId,
			});

			return; // Early return for STOP
		}

		// Find or create contact mapping
		let ghlContactId: string;
		const existingMapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.phoneNumber, phone),
		});

		if (existingMapping) {
			ghlContactId = existingMapping.ghlContactId;
		} else {
			// Create contact in GHL
			ghlContactId = await getOrCreateContact(undefined, phone);

			// Create mapping (alowareContactId is null for texting-only contacts)
			await db.insert(contactMappings).values({
				alowareContactId: null, // No Aloware contact for texting-only contacts
				ghlContactId,
				phoneNumber: phone,
				syncDirection: "bidirectional",
			});
		}

		// Add message directly to GHL - conversation will be auto-created if needed
		// GHL "Add an inbound message" endpoint accepts contactId directly (no conversationId needed)
		// Docs: https://marketplace.gohighlevel.com/docs/ghl/conversations/messages
		// Note: Either conversationId OR contactId is required - we use contactId only
		let ghlMessageId: string | null = null;
		try {
			// Call addInboundMessage/sendOutboundMessage directly with just contactId
			// Don't pass conversationId - let GHL auto-create the conversation
			if (payload.direction === "inbound") {
				const { addInboundMessage } = await import("@/lib/ghl/conversations");
				ghlMessageId = await addInboundMessage(
					ghlContactId,
					payload.body || "",
					{
						phoneNumber: phone,
					}
				);
			} else {
				const { sendOutboundMessage } = await import("@/lib/ghl/conversations");
				ghlMessageId = await sendOutboundMessage(
					ghlContactId,
					payload.body || "",
					{
						phoneNumber: phone,
					}
				);
			}
			console.log(`[texting-to-ghl] Successfully created message in GHL: ${ghlMessageId}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`[texting-to-ghl] Error creating message in GHL:`, errorMessage);
			
			// Still store the mapping - we can retry later
			ghlMessageId = null;
		}

		// Store message mapping
		await db
			.insert(messageMappings)
			.values({
				textingMessageId: payload.messageId || null,
				ghlMessageId: ghlMessageId || null,
				ghlContactId,
				conversationId: payload.conversationId || null,
				fromNumber: payload.from || null,
				toNumber: payload.to || null,
				direction: payload.direction || null,
			})
			.onConflictDoNothing();

		// Log success
		await db.insert(syncLog).values({
			direction: "texting_to_ghl",
			entityType: "message",
			entityId: messageId,
			sourceId: messageId,
			targetId: ghlContactId,
			status: "success",
			finishedAt: new Date(),
			correlationId,
		});
	} catch (error) {
		console.error("[texting-to-ghl] Error syncing message:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Log error
		await db.insert(syncLog).values({
			direction: "texting_to_ghl",
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

