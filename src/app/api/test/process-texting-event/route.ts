import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { textingWebhookEvents } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { processTextingEvent } from "@/lib/texting/jobs";

export const dynamic = "force-dynamic";

/**
 * Test endpoint to process a texting event directly
 * POST /api/test/process-texting-event
 * Body: { "eventId": "uuid" } or no body to process first pending event
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}));
		const eventId = body.eventId;

		let event;
		if (eventId) {
			// Process specific event
			event = await db.query.textingWebhookEvents.findFirst({
				where: eq(textingWebhookEvents.id, eventId),
			});
		} else {
			// Process first pending event
			const pendingEvents = await db
				.select()
				.from(textingWebhookEvents)
				.where(eq(textingWebhookEvents.status, "pending"))
				.limit(1);
			
			if (pendingEvents.length === 0) {
				return NextResponse.json({
					success: false,
					message: "No pending events found",
				});
			}
			event = pendingEvents[0];
		}

		if (!event) {
			return NextResponse.json(
				{ error: "Event not found" },
				{ status: 404 }
			);
		}

		// Process the event directly
		await processTextingEvent({
			id: `test-${Date.now()}`,
			data: { textingEventId: event.id },
		});

		// Check final status
		const updated = await db.query.textingWebhookEvents.findFirst({
			where: eq(textingWebhookEvents.id, event.id),
		});

		return NextResponse.json({
			success: true,
			message: "Event processed",
			event: {
				id: updated?.id,
				status: updated?.status,
				eventType: updated?.eventType,
				errorMessage: updated?.errorMessage,
			},
		});
	} catch (error) {
		console.error("[test/process-texting-event] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}


