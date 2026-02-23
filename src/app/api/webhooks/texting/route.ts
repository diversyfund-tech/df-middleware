import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { textingWebhookEvents } from "@/server/db/schema";
import { normalizeTextingWebhook } from "@/lib/texting/normalize";
import { createHash, createHmac } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Verify texting webhook signature using HMAC-SHA256
 * Supports both signature header (HMAC-SHA256) and simple secret header (backward compatibility)
 */
function verifyTextingWebhookSignature(bodyText: string, req: NextRequest): boolean {
	const expectedSecret = env.VERITY_WEBHOOK_SECRET?.trim();
	if (!expectedSecret) {
		return false;
	}
	
	// Check for HMAC signature header first
	const signature = req.headers.get("X-Texting-Signature") || req.headers.get("X-Signature");
	if (signature) {
		try {
			const hmac = createHmac("sha256", expectedSecret);
			hmac.update(bodyText);
			const expectedSignature = hmac.digest("hex");
			
			// Constant-time comparison
			if (signature.length !== expectedSignature.length) {
				return false;
			}
			
			let match = 0;
			for (let i = 0; i < signature.length; i++) {
				match |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
			}
			
			return match === 0;
		} catch (error) {
			console.error("[texting.webhook] Error verifying signature:", error);
			return false;
		}
	}
	
	// Fallback to simple secret header validation (backward compatibility)
	const secret = req.headers.get("X-Texting-Secret");
	if (secret) {
		return secret.trim() === expectedSecret;
	}
	
	return false;
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

	// Get raw body text for signature verification
	let bodyText: string;
	let rawBody: unknown;
	try {
		bodyText = await req.text();
		rawBody = JSON.parse(bodyText);
	} catch (error) {
		console.error("[texting.webhook] Invalid JSON:", error);
		return new NextResponse("Invalid JSON", { status: 400 });
	}

	// Verify webhook signature/secret
	if (!verifyTextingWebhookSignature(bodyText, req)) {
		console.error("[texting.webhook] Invalid signature or secret");
		return new NextResponse("Unauthorized", { status: 401 });
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

