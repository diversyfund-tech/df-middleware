import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { quarantineEvents } from "@/server/db/schema";

export const dynamic = "force-dynamic";

/**
 * Validate admin secret header
 */
function validateAdminSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-ADMIN-SECRET");
	return secret === env.DF_ADMIN_SECRET;
}

/**
 * Quarantine a webhook event
 * POST /api/admin/events/:id/quarantine
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
		const body = await req.json().catch(() => ({}));
		const reason = body.reason || "Manual quarantine";
		const eventSource = body.eventSource || "webhook"; // 'webhook' | 'texting'

		// Insert quarantine record
		await db.insert(quarantineEvents).values({
			eventId,
			eventSource,
			reason,
			quarantinedBy: body.quarantinedBy || null,
		}).onConflictDoNothing();

		return NextResponse.json({
			success: true,
			message: "Event quarantined",
			eventId,
		});
	} catch (error) {
		console.error("[admin/events/quarantine] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

