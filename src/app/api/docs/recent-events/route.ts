/**
 * Recent Events API
 * 
 * Returns simplified recent webhook events for visual documentation.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);

		const events = await db.query.webhookEvents.findMany({
			limit: Math.min(limit, 100), // Cap at 100
			orderBy: [desc(webhookEvents.createdAt)],
			columns: {
				id: true,
				source: true,
				eventType: true,
				entityType: true,
				status: true,
				createdAt: true,
			},
		});

		return NextResponse.json({
			timestamp: new Date().toISOString(),
			events: events.map((event) => ({
				id: event.id,
				source: event.source,
				eventType: event.eventType,
				entityType: event.entityType,
				status: event.status,
				createdAt: event.createdAt.toISOString(),
			})),
		});
	} catch (error) {
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}
