import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { computeDedupeKey, extractEventType, extractEntityId } from "@/lib/sync/utils";
import { startBoss, WEBHOOK_EVENT_QUEUE } from "@/lib/jobs/boss";

export const dynamic = "force-dynamic";

/**
 * Verify webhook signature (placeholder - implement HMAC-SHA256 if secret is configured)
 */
function verifyWebhookSignature(): boolean {
	// TODO: Implement HMAC-SHA256 signature verification
	// For now, return true if secret is configured
	return true;
}

export async function POST(req: NextRequest) {
	console.log("[ghl.webhook] Received webhook request");
	
	// Parse body first
	let body: unknown;
	let bodyText: string;
	
	try {
		bodyText = await req.text();
		body = JSON.parse(bodyText);
	} catch (error) {
		console.error("[ghl.webhook] Invalid JSON:", error);
		return new NextResponse("Invalid JSON", { status: 400 });
	}
	
	// Verify webhook signature if secret exists
	const webhookSecret = env.GHL_WEBHOOK_SECRET;
	const signature = req.headers.get("x-ghl-signature") || req.headers.get("signature");
	
	if (webhookSecret && signature) {
		const isValid = verifyWebhookSignature();
		if (!isValid) {
			console.error("[ghl.webhook] Invalid webhook signature");
			return new NextResponse("Invalid signature", { status: 401 });
		}
	}
	
	// Extract event information
	let eventType = extractEventType(body);
	
	// If no explicit event type, infer from payload structure
	if (!eventType && typeof body === "object" && body !== null) {
		const obj = body as Record<string, unknown>;
		const hasAppointmentFields = "startTime" in obj || "start_time" in obj || 
		                              "endTime" in obj || "end_time" in obj ||
		                              "calendarId" in obj || "calendar_id" in obj;
		if (hasAppointmentFields) {
			eventType = "appointment.created";
		} else {
			const hasContactFields = "contactId" in obj || "contact_id" in obj || 
			                         ("id" in obj && ("firstName" in obj || "first_name" in obj || "email" in obj));
			if (hasContactFields) {
				eventType = "contact.updated";
			}
		}
	}
	
	if (!eventType) {
		console.log("[ghl.webhook] No event type found, treating as test ping");
		return NextResponse.json({ success: true, message: "Test ping received" });
	}
	
	const entityType = eventType.includes("appointment") ? "appointment" :
		eventType.includes("contact") ? "contact" :
		eventType.includes("tag") || eventType.includes("segment") ? "tag" :
		eventType.includes("opportunity") || eventType.includes("pipeline") ? "opportunity" :
		"unknown";
	
	const entityId = extractEntityId(body);
	
	if (!entityId) {
		console.warn("[ghl.webhook] No entity ID found in payload");
		return NextResponse.json({ success: true, ignored: true, reason: "No entity ID" });
	}
	
	console.log(`[ghl.webhook] Processing event: ${eventType} for ${entityType}:${entityId}`);
	
	// Compute dedupe key
	const dedupeKey = computeDedupeKey("ghl", eventType, entityId, body);
	
	// Store webhook event and auto-enqueue for processing
	let insertedEventId: string | null = null;
	try {
		const inserted = await db
			.insert(webhookEvents)
			.values({
				source: "ghl",
				eventType,
				entityType,
				entityId,
				payloadJson: body as Record<string, unknown>,
				dedupeKey,
				status: "pending",
			})
			.returning({ id: webhookEvents.id })
			.onConflictDoNothing({ target: webhookEvents.dedupeKey });
		
		// If event was inserted (not a duplicate), get the ID for enqueueing
		if (inserted && inserted.length > 0) {
			insertedEventId = inserted[0]!.id;
		} else {
			// Duplicate event - that's fine, just return success
			console.log(`[ghl.webhook] Duplicate event detected (dedupeKey: ${dedupeKey}), ignoring`);
			return NextResponse.json({ success: true, message: "Duplicate event ignored" });
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorCode = (error as { code?: string }).code;
		if (errorMessage.includes("duplicate") || errorCode === "23505") {
			console.log(`[ghl.webhook] Duplicate event detected (dedupeKey: ${dedupeKey}), ignoring`);
			return NextResponse.json({ success: true, message: "Duplicate event ignored" });
		}
		console.error("[ghl.webhook] Error inserting webhook event:", error);
		return new NextResponse("Internal server error", { status: 500 });
	}
	
	// Auto-enqueue for processing (if event was inserted)
	if (insertedEventId) {
		try {
			const boss = await startBoss();
			await boss.send(WEBHOOK_EVENT_QUEUE, {
				webhookEventId: insertedEventId,
			}, {
				retryLimit: 10,
				retryDelay: 60,
				retryBackoff: true,
			});
			console.log(`[ghl.webhook] Auto-enqueued event ${insertedEventId} for processing`);
		} catch (enqueueError) {
			// Log but don't fail the webhook - event is stored and can be manually enqueued
			console.error(`[ghl.webhook] Failed to auto-enqueue event ${insertedEventId}:`, enqueueError);
		}
	}
	
	// Return 200 immediately
	return NextResponse.json({ success: true, message: "Webhook received" });
}

