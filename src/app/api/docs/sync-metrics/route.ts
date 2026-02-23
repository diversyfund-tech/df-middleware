/**
 * Sync Metrics API
 * 
 * Returns recent sync operations for visual documentation.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { syncLog } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		const limit = parseInt(req.nextUrl.searchParams.get("limit") || "30", 10);

		const syncs = await db.query.syncLog.findMany({
			limit: Math.min(limit, 100), // Cap at 100
			orderBy: [desc(syncLog.finishedAt)],
			columns: {
				id: true,
				direction: true,
				entityType: true,
				status: true,
				finishedAt: true,
				errorMessage: true,
			},
		});

		return NextResponse.json({
			timestamp: new Date().toISOString(),
			syncs: syncs.map((sync) => ({
				id: sync.id,
				direction: sync.direction,
				entityType: sync.entityType,
				status: sync.status,
				finishedAt: sync.finishedAt?.toISOString() || new Date().toISOString(),
				errorMessage: sync.errorMessage || undefined,
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
