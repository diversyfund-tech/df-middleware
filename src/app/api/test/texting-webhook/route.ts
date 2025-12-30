import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { textingWebhookEvents } from "@/server/db/schema";
import { normalizeTextingWebhook } from "@/lib/texting/normalize";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Compute dedupe key for texting webhook events
 */
function computeTextingDedupeKey(
	eventType: string,
	entityId: string,
	timestamp?: string
): string {
	const hash = createHash("sha256")
		.update(`texting:${eventType}:${entityId}:${timestamp || ""}`)
		.digest("hex")
		.substring(0, 16);

	return `texting:${eventType}:${entityId}:${hash}`;
}

/**
 * Compute entity ID from payload
 */
function computeEntityId(payload: {
	messageId?: string;
	conversationId?: string;
	body?: string;
	timestamp?: string;
	from?: string;
	to?: string;
}): string {
	if (payload.messageId) {
		return payload.messageId;
	}
	if (payload.conversationId) {
		return payload.conversationId;
	}

	// Fallback: hash of body+timestamp+from+to
	const hash = createHash("sha256")
		.update(`${payload.body || ""}:${payload.timestamp || ""}:${payload.from || ""}:${payload.to || ""}`)
		.digest("hex")
		.substring(0, 16);

	return hash;
}

/**
 * Test endpoint to create a test texting webhook event
 * POST /api/test/texting-webhook
 * 
 * Body: {
 *   "from": "+1234567890",
 *   "to": "+1987654321",
 *   "body": "Test message",
 *   "direction": "inbound" | "outbound",
 *   "eventType": "message.received" | "message.sent"
 * }
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		
		// Build test payload
		const testPayload = {
			type: body.eventType || "message.received",
			message: {
				id: body.messageId || `test_msg_${Date.now()}`,
				conversationId: body.conversationId || `test_conv_${Date.now()}`,
				from: body.from || "+1234567890",
				to: body.to || "+1987654321",
				body: body.body || "Test message from middleware",
				timestamp: body.timestamp || new Date().toISOString(),
				direction: body.direction || "inbound",
			},
		};

		// Normalize payload
		const payload = normalizeTextingWebhook(testPayload);

		// Compute entity ID
		const entityId = computeEntityId(payload);

		// Compute dedupe key
		const dedupeKey = computeTextingDedupeKey(payload.eventType, entityId, payload.timestamp);

		// Store webhook event
		const result = await db
			.insert(textingWebhookEvents)
			.values({
				eventType: payload.eventType,
				entityType: payload.eventType.includes("message") ? "message" :
					payload.eventType.includes("conversation") ? "conversation" :
					payload.eventType.includes("optout") ? "optout" : "message",
				entityId,
				conversationId: payload.conversationId || null,
				fromNumber: payload.from || null,
				toNumber: payload.to || null,
				payloadJson: testPayload as Record<string, unknown>,
				dedupeKey,
				status: "pending",
			})
			.returning();

		return NextResponse.json({
			success: true,
			message: "Test texting webhook event created",
			event: {
				id: result[0].id,
				eventType: result[0].eventType,
				status: result[0].status,
				entityId: result[0].entityId,
			},
			nextStep: "Call /api/jobs/enqueue-texting-pending to process this event",
		});
	} catch (error) {
		console.error("[test/texting-webhook] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}


