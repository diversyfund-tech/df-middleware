import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { computeDedupeKey, extractEventType, extractEntityId } from "@/lib/sync/utils";
import { startBoss, WEBHOOK_EVENT_QUEUE } from "@/lib/jobs/boss";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Validate Basic Auth credentials
 */
function validateBasicAuth(req: NextRequest): boolean {
	const authHeader = req.headers.get("authorization");
	if (!authHeader || !authHeader.startsWith("Basic ")) {
		return false;
	}

	const base64Credentials = authHeader.slice(6);
	const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
	const [username, password] = credentials.split(":");

	const expectedUser = env.ALOWARE_WEBHOOK_BASIC_USER.trim();
	const expectedPass = env.ALOWARE_WEBHOOK_BASIC_PASS.trim();

	if (!expectedUser || !expectedPass) {
		return false;
	}

	return username === expectedUser && password === expectedPass;
}

/**
 * Check if event is allowed
 */
function isEventAllowed(event: string): boolean {
	const allowedEvents = env.ALOWARE_WEBHOOK_ALLOWED_EVENTS;
	if (!allowedEvents) {
		return true; // Default: allow all if not configured
	}

	const allowedList = allowedEvents.split(",").map((e) => e.trim());
	
	// Check exact match first
	if (allowedList.includes(event)) {
		return true;
	}
	
	// Check pattern matches for call events
	if (event.startsWith("OutboundPhoneCall-") && allowedList.some((e) => e.startsWith("OutboundPhoneCall-"))) {
		return true;
	}
	if (event.startsWith("InboundPhoneCall-") && allowedList.some((e) => e.startsWith("InboundPhoneCall-"))) {
		return true;
	}
	
	return false;
}

export async function POST(req: NextRequest) {
	console.log("[aloware.webhook] Received webhook request");

	// Validate Basic Auth
	const authValid = validateBasicAuth(req);
	if (!authValid) {
		console.error("[aloware.webhook] Invalid Basic Auth credentials");
		return new NextResponse("Unauthorized", { status: 401 });
	}

	// Parse JSON body
	let body: unknown;
	try {
		body = await req.json();
	} catch (error) {
		console.error("[aloware.webhook] Invalid JSON:", error);
		return new NextResponse("Invalid JSON", { status: 400 });
	}

	// Extract event name
	let eventName: string | null = extractEventType(body);
	if (!eventName && typeof body === "object" && body !== null) {
		const obj = body as Record<string, unknown>;
		if ("data" in obj && typeof obj.data === "object" && obj.data !== null) {
			const data = obj.data as Record<string, unknown>;
			if ("event" in data) {
				eventName = String(data.event);
			}
		}
	}

	// If no event name found, treat as test ping
	if (!eventName) {
		console.log("[aloware.webhook] No event field found, treating as test ping");
		return NextResponse.json({ success: true, message: "Test ping received" });
	}

	// Check if event is allowed
	if (!isEventAllowed(eventName)) {
		console.log(`[aloware.webhook] Event ${eventName} not in allowed list, ignoring`);
		return NextResponse.json({ success: true, ignored: true });
	}

	console.log(`[aloware.webhook] Processing event: ${eventName}`);

	// Extract entity information (improved detection)
	const entityType = 
		eventName.includes("Contact") ? "contact" :
		eventName.includes("PhoneCall") || eventName.includes("Call") ? "call" :
		eventName.includes("Communication") ? "communication" :
		eventName.includes("Appointment") ? "appointment" :
		eventName.includes("Voicemail") ? "voicemail" :
		eventName.includes("Recording") ? "recording" :
		eventName.includes("Transcription") ? "transcription" :
		eventName.includes("Summarized") ? "call_summary" :
		"unknown";

	const entityId = extractEntityId(body);

	if (!entityId) {
		console.warn("[aloware.webhook] No entity ID found in payload");
		return NextResponse.json({ success: true, ignored: true, reason: "No entity ID" });
	}

	// Compute dedupe key
	const dedupeKey = computeDedupeKey("aloware", eventName, entityId, body);

	// Store webhook event and auto-enqueue for processing
	let insertedEventId: string | null = null;
	try {
		const inserted = await db
			.insert(webhookEvents)
			.values({
				source: "aloware",
				eventType: eventName,
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
			console.log(`[aloware.webhook] Duplicate event detected (dedupeKey: ${dedupeKey}), ignoring`);
			return NextResponse.json({ success: true, message: "Duplicate event ignored" });
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorCode = (error as { code?: string }).code;
		if (errorMessage.includes("duplicate") || errorCode === "23505") {
			console.log(`[aloware.webhook] Duplicate event detected (dedupeKey: ${dedupeKey}), ignoring`);
			return NextResponse.json({ success: true, message: "Duplicate event ignored" });
		}
		console.error("[aloware.webhook] Error inserting webhook event:", error);
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
			console.log(`[aloware.webhook] Auto-enqueued event ${insertedEventId} for processing`);
		} catch (enqueueError) {
			// Log but don't fail the webhook - event is stored and can be manually enqueued
			console.error(`[aloware.webhook] Failed to auto-enqueue event ${insertedEventId}:`, enqueueError);
		}
	}

	// Return 200 immediately
	return NextResponse.json({ success: true, message: "Webhook received" });
}

