import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { startBoss, WEBHOOK_EVENT_QUEUE } from "@/lib/jobs/boss";

export const dynamic = "force-dynamic";

/**
 * Validate admin secret header
 */
function validateAdminSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-ADMIN-SECRET");
	return secret === env.DF_ADMIN_SECRET;
}

/**
 * Replay a webhook event
 * POST /api/admin/events/:id/replay
 */
export async function POST(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	if (!validateAdminSecret(req)) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		const eventId = params.id;

		// Load event
		const event = await db.query.webhookEvents.findFirst({
			where: eq(webhookEvents.id, eventId),
		});

		if (!event) {
			return NextResponse.json(
				{ error: "Event not found" },
				{ status: 404 }
			);
		}

		// Reset status to pending
		await db
			.update(webhookEvents)
			.set({ status: "pending" })
			.where(eq(webhookEvents.id, eventId));

		// Enqueue job
		const boss = await startBoss();
		await boss.send(WEBHOOK_EVENT_QUEUE, {
			webhookEventId: eventId,
		});

		return NextResponse.json({
			success: true,
			message: "Event replayed",
			eventId,
		});
	} catch (error) {
		console.error("[admin/events/replay] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

