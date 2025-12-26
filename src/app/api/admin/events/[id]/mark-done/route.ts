import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Validate admin secret header
 */
function validateAdminSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-ADMIN-SECRET");
	return secret === env.DF_ADMIN_SECRET;
}

/**
 * Mark a webhook event as done
 * POST /api/admin/events/:id/mark-done
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

		// Update event status
		await db
			.update(webhookEvents)
			.set({
				status: "done",
				processedAt: new Date(),
			})
			.where(eq(webhookEvents.id, eventId));

		return NextResponse.json({
			success: true,
			message: "Event marked as done",
			eventId,
		});
	} catch (error) {
		console.error("[admin/events/mark-done] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

