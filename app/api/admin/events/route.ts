import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Validate admin secret header
 */
function validateAdminSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-ADMIN-SECRET");
	return secret === env.DF_ADMIN_SECRET;
}

/**
 * Get webhook events (admin endpoint)
 * GET /api/admin/events?source=aloware&status=pending&entityId=xxx&limit=50
 */
export async function GET(req: NextRequest) {
	if (!validateAdminSecret(req)) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		const url = new URL(req.url);
		const source = url.searchParams.get("source");
		const status = url.searchParams.get("status");
		const entityId = url.searchParams.get("entityId");
		const limitParam = url.searchParams.get("limit");
		const limit = limitParam ? parseInt(limitParam, 10) : 50;

		// Build query conditions
		const conditions = [];
		if (source) {
			conditions.push(eq(webhookEvents.source, source));
		}
		if (status) {
			conditions.push(eq(webhookEvents.status, status));
		}
		if (entityId) {
			conditions.push(eq(webhookEvents.entityId, entityId));
		}

		let query = db.select().from(webhookEvents);
		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as typeof query;
		}

		const events = await query
			.orderBy(webhookEvents.receivedAt)
			.limit(limit);

		// Format response (redact PII from payload)
		const formatted = events.map(event => {
			const payload = event.payloadJson as Record<string, unknown>;
			// Redact sensitive fields
			const redactedPayload = { ...payload };
			if (redactedPayload.email) redactedPayload.email = "[REDACTED]";
			if (redactedPayload.phone) redactedPayload.phone = "[REDACTED]";
			if (redactedPayload.phone_number) redactedPayload.phone_number = "[REDACTED]";

			return {
				id: event.id,
				receivedAt: event.receivedAt,
				source: event.source,
				eventType: event.eventType,
				entityType: event.entityType,
				entityId: event.entityId,
				status: event.status,
				errorMessage: event.errorMessage,
				processedAt: event.processedAt,
				payload: redactedPayload,
			};
		});

		return NextResponse.json({
			events: formatted,
			count: formatted.length,
		});
	} catch (error) {
		console.error("[admin/events] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

