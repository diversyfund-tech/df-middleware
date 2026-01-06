import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { broadcastWebhookEvents } from "@/server/db/schema";
import { createHash } from "crypto";
import { startBoss, BROADCAST_EVENT_QUEUE } from "@/lib/jobs/boss";

export const dynamic = "force-dynamic";

/**
 * Validate broadcast webhook secret (from Verity)
 */
function validateBroadcastSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-Broadcast-Secret");
	const expectedSecret = env.VERITY_WEBHOOK_SECRET?.trim();
	
	if (!secret || !expectedSecret) {
		return false;
	}
	
	return secret.trim() === expectedSecret;
}

/**
 * Compute dedupe key for broadcast webhook events
 */
function computeBroadcastDedupeKey(
	broadcastId: string,
	eventType: string,
	timestamp?: string
): string {
	const hash = createHash("sha256")
		.update(`broadcast:${broadcastId}:${eventType}:${timestamp || ""}`)
		.digest("hex")
		.substring(0, 16);

	return `broadcast:${broadcastId}:${eventType}:${hash}`;
}

/**
 * Broadcast webhook endpoint
 * POST /api/webhooks/broadcast
 */
export async function POST(req: NextRequest) {
	console.log("[broadcast.webhook] Received webhook request");

	// Validate secret
	if (!validateBroadcastSecret(req)) {
		console.error("[broadcast.webhook] Invalid secret");
		return new NextResponse("Unauthorized", { status: 401 });
	}

	// Parse JSON body
	let rawBody: unknown;
	try {
		rawBody = await req.json();
	} catch (error) {
		console.error("[broadcast.webhook] Invalid JSON:", error);
		return new NextResponse("Invalid JSON", { status: 400 });
	}

	const payload = rawBody as { broadcastId?: string; eventType?: string; timestamp?: string };

	if (!payload.broadcastId || !payload.eventType) {
		console.error("[broadcast.webhook] Missing required fields: broadcastId or eventType");
		return new NextResponse("Missing required fields", { status: 400 });
	}

	const { broadcastId, eventType, timestamp } = payload;

	// Compute dedupe key
	const dedupeKey = computeBroadcastDedupeKey(broadcastId, eventType, timestamp);

	// Store webhook event and auto-enqueue for processing
	let insertedEventId: string | null = null;
	try {
		const inserted = await db
			.insert(broadcastWebhookEvents)
			.values({
				broadcastId,
				eventType,
				payloadJson: rawBody as Record<string, unknown>,
				dedupeKey,
				status: "pending",
			})
			.returning({ id: broadcastWebhookEvents.id })
			.onConflictDoNothing({ target: broadcastWebhookEvents.dedupeKey });
		
		// If event was inserted (not a duplicate), get the ID for enqueueing
		if (inserted && inserted.length > 0) {
			insertedEventId = inserted[0]!.id;
		} else {
			// Duplicate event - that's fine, just return success
			console.log(`[broadcast.webhook] Duplicate event detected (dedupeKey: ${dedupeKey}), ignoring`);
			return NextResponse.json({ success: true, message: "Duplicate event ignored" });
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorCode = (error as { code?: string }).code;
		if (errorMessage.includes("duplicate") || errorCode === "23505") {
			console.log(`[broadcast.webhook] Duplicate event detected (dedupeKey: ${dedupeKey}), ignoring`);
			return NextResponse.json({ success: true, message: "Duplicate event ignored" });
		}
		console.error("[broadcast.webhook] Error inserting webhook event:", error);
		return new NextResponse("Internal server error", { status: 500 });
	}
	
	// Auto-enqueue for processing (if event was inserted)
	if (insertedEventId) {
		try {
			const boss = await startBoss();
			await boss.send(BROADCAST_EVENT_QUEUE, {
				broadcastEventId: insertedEventId,
			}, {
				retryLimit: 10,
				retryDelay: 60,
				retryBackoff: true,
			});
			console.log(`[broadcast.webhook] Auto-enqueued event ${insertedEventId} for processing`);
		} catch (enqueueError) {
			// Log but don't fail the webhook - event is stored and can be manually enqueued
			console.error(`[broadcast.webhook] Failed to auto-enqueue event ${insertedEventId}:`, enqueueError);
		}
	}

	// Return 200 immediately
	return NextResponse.json({ success: true, message: "Webhook received" });
}


