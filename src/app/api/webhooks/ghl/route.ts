import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { computeDedupeKey, extractEventType, extractEntityId } from "@/lib/sync/utils";
import { startBoss, WEBHOOK_EVENT_QUEUE } from "@/lib/jobs/boss";
import { createHmac } from "crypto";
import { logger } from "@/lib/logger";
import { webhookEventsTotal } from "@/lib/metrics";
import { WEBHOOK_SOURCES } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Verify GHL webhook signature using HMAC-SHA256
 * GHL sends signature in x-ghl-signature header as hex-encoded HMAC-SHA256 hash
 */
function verifyWebhookSignature(bodyText: string, signature: string, secret: string): boolean {
	try {
		// Compute HMAC-SHA256 hash of the body
		const hmac = createHmac("sha256", secret);
		hmac.update(bodyText);
		const expectedSignature = hmac.digest("hex");
		
		// Compare signatures using constant-time comparison to prevent timing attacks
		if (signature.length !== expectedSignature.length) {
			return false;
		}
		
		let match = 0;
		for (let i = 0; i < signature.length; i++) {
			match |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
		}
		
		return match === 0;
	} catch (error) {
		console.error("[ghl.webhook] Error verifying signature:", error);
		return false;
	}
}

export async function POST(req: NextRequest) {
	const startTime = Date.now();
	logger.info({ source: "ghl" }, "Received GHL webhook");
	
	// Parse body first
	let body: unknown;
	let bodyText: string;
	
	try {
		bodyText = await req.text();
		body = JSON.parse(bodyText);
	} catch (error) {
		logger.error({ source: "ghl", error }, "Invalid JSON in webhook");
		return new NextResponse("Invalid JSON", { status: 400 });
	}
	
	// Verify webhook signature if secret exists
	const webhookSecret = env.GHL_WEBHOOK_SECRET;
	const signature = req.headers.get("x-ghl-signature") || req.headers.get("signature");
	
	if (webhookSecret && signature) {
		const isValid = verifyWebhookSignature(bodyText, signature, webhookSecret);
		if (!isValid) {
			logger.warn({ source: "ghl" }, "Invalid webhook signature");
			return new NextResponse("Invalid signature", { status: 401 });
		}
	} else if (webhookSecret && !signature) {
		// Secret is configured but no signature provided - reject in production
		if (env.NODE_ENV === "production") {
			logger.warn({ source: "ghl" }, "Webhook secret configured but no signature provided");
			return new NextResponse("Signature required", { status: 401 });
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
		logger.info({ source: "ghl" }, "No event type found, treating as test ping");
		return NextResponse.json({ success: true, message: "Test ping received" });
	}
	
	const entityType = eventType.includes("appointment") ? "appointment" :
		eventType.includes("contact") ? "contact" :
		eventType.includes("tag") || eventType.includes("segment") ? "tag" :
		eventType.includes("opportunity") || eventType.includes("pipeline") ? "opportunity" :
		"unknown";
	
	const entityId = extractEntityId(body);
	
	if (!entityId) {
		logger.warn({ source: "ghl", eventType }, "No entity ID found in payload");
		return NextResponse.json({ success: true, ignored: true, reason: "No entity ID" });
	}
	
	logger.info({
		source: "ghl",
		eventType,
		entityType,
		entityId,
	}, "Processing GHL webhook event");

	// Record webhook metric
	webhookEventsTotal.inc({ source: WEBHOOK_SOURCES.GHL, event_type: eventType });
	
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
			logger.info({ source: "ghl", dedupeKey }, "Duplicate event detected, ignoring");
			return NextResponse.json({ success: true, message: "Duplicate event ignored" });
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorCode = (error as { code?: string }).code;
		if (errorMessage.includes("duplicate") || errorCode === "23505") {
			logger.info({ source: "ghl", dedupeKey }, "Duplicate event detected, ignoring");
			return NextResponse.json({ success: true, message: "Duplicate event ignored" });
		}
		logger.error({ source: "ghl", error }, "Error inserting webhook event");
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
			logger.info({ source: "ghl", eventId: insertedEventId }, "Auto-enqueued event for processing");
		} catch (enqueueError) {
			// Log but don't fail the webhook - event is stored and can be manually enqueued
			logger.error({ source: "ghl", eventId: insertedEventId, error: enqueueError }, "Failed to auto-enqueue event");
		}
	}
	
	// Forward webhook to Verity (if configured)
	// This ensures Verity receives appointment and contact webhooks for analytics tracking
	if (env.VERITY_BASE_URL) {
		try {
			const verityWebhookUrl = `${env.VERITY_BASE_URL}/api/integrations/ghl/webhook`;
			const verityWebhookSecret = env.VERITY_WEBHOOK_SECRET;
			
			logger.info({ source: "ghl", eventType }, "Forwarding event to Verity");
			
			const forwardResponse = await fetch(verityWebhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					// Forward original signature if present
					...(signature && { "x-ghl-signature": signature }),
					// Add middleware forwarding header
					"X-Middleware-Forwarded": "true",
					...(verityWebhookSecret && { "X-Middleware-Secret": verityWebhookSecret }),
				},
				body: bodyText, // Forward original body text to preserve signature verification
			});
			
			if (!forwardResponse.ok) {
				const errorText = await forwardResponse.text();
				logger.error({
					source: "ghl",
					eventType,
					status: forwardResponse.status,
					error: errorText.substring(0, 200),
				}, "Verity returned error when forwarding webhook");
				// Don't fail the webhook if forwarding fails - middleware processing continues
			} else {
				logger.info({ source: "ghl", eventType }, "Successfully forwarded event to Verity");
			}
		} catch (forwardError) {
			// Log but don't fail the webhook - middleware processing continues
			logger.error({ source: "ghl", eventType, error: forwardError }, "Error forwarding to Verity");
		}
	}
	
	const duration = (Date.now() - startTime) / 1000;
	logger.info({ source: "ghl", eventType, duration }, "Webhook processed successfully");
	
	// Return 200 immediately
	return NextResponse.json({ success: true, message: "Webhook received" });
}

