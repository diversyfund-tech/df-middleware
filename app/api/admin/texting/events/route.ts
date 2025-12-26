import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { textingWebhookEvents } from "@/server/db/schema";
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
 * Get texting webhook events (admin debug endpoint)
 * GET /api/admin/texting/events?status=pending&limit=50
 */
export async function GET(req: NextRequest) {
	if (!validateAdminSecret(req)) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		const url = new URL(req.url);
		const status = url.searchParams.get("status");
		const limitParam = url.searchParams.get("limit");
		const limit = limitParam ? parseInt(limitParam, 10) : 50;
		const includeBody = url.searchParams.get("includeBody") === "true";

		// Build query
		let query = db.select().from(textingWebhookEvents);

		if (status) {
			query = query.where(eq(textingWebhookEvents.status, status)) as typeof query;
		}

		const events = await query
			.orderBy(textingWebhookEvents.receivedAt)
			.limit(limit);

		// Format response (redact PII unless includeBody=true)
		const formatted = events.map(event => {
			const payload = event.payloadJson as Record<string, unknown>;
			const body = includeBody ? payload.body : "[REDACTED]";

			return {
				id: event.id,
				receivedAt: event.receivedAt,
				eventType: event.eventType,
				entityId: event.entityId,
				status: event.status,
				errorMessage: event.errorMessage,
				fromNumber: event.fromNumber ? `${event.fromNumber.substring(0, 4)}***` : null,
				toNumber: event.toNumber ? `${event.toNumber.substring(0, 4)}***` : null,
				body: includeBody ? body : undefined,
			};
		});

		return NextResponse.json({
			events: formatted,
			count: formatted.length,
		});
	} catch (error) {
		console.error("[admin/texting/events] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

