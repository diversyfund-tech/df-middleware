import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { textingWebhookEvents } from "@/server/db/schema";
import { normalizeTextingWebhook } from "@/lib/texting/normalize";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Validate texting webhook secret (from Verity)
 */
function validateTextingSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-Texting-Secret");
	return secret === env.VERITY_WEBHOOK_SECRET;
}

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
 * Texting webhook endpoint
 * POST /api/webhooks/texting
 */
export async function POST(req: NextRequest) {
	console.log("[texting.webhook] Received webhook request");

	// Validate secret
	if (!validateTextingSecret(req)) {
		console.error("[texting.webhook] Invalid secret");
		return new NextResponse("Unauthorized", { status: 401 });
	}

	// Parse JSON body
	let rawBody: unknown;
	try {
		rawBody = await req.json();
	} catch (error) {
		console.error("[texting.webhook] Invalid JSON:", error);
		return new NextResponse("Invalid JSON", { status: 400 });
	}

	// Normalize payload
	const payload = normalizeTextingWebhook(rawBody);

	// Compute entity ID
	const entityId = computeEntityId(payload);

	// Compute dedupe key
	const dedupeKey = computeTextingDedupeKey(payload.eventType, entityId, payload.timestamp);

	// Store webhook event
	try {
		await db
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
				payloadJson: rawBody as Record<string, unknown>,
				dedupeKey,
				status: "pending",
			})
			.onConflictDoNothing({ target: textingWebhookEvents.dedupeKey });
	} catch (error) {
		// If duplicate, that's fine - return success
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorCode = (error as { code?: string }).code;
		if (errorMessage.includes("duplicate") || errorCode === "23505") {
			console.log(`[texting.webhook] Duplicate event detected (dedupeKey: ${dedupeKey}), ignoring`);
			return NextResponse.json({ success: true, message: "Duplicate event ignored" });
		}
		console.error("[texting.webhook] Error inserting webhook event:", error);
		return new NextResponse("Internal server error", { status: 500 });
	}

	// Log minimal diagnostics (no PII)
	console.log(`[texting.webhook] Event stored: ${payload.eventType}, messageId: ${payload.messageId || "none"}`);

	// Return 200 immediately
	return NextResponse.json({ success: true, message: "Webhook received" });
}

