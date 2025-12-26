import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { callListRegistry, contactListMemberships, syncLog } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Validate admin secret
 */
function validateAdminSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-ADMIN-SECRET");
	return secret === env.DF_ADMIN_SECRET;
}

/**
 * Get call list status (admin endpoint)
 * GET /api/admin/lists/status
 */
export async function GET(req: NextRequest) {
	if (!validateAdminSecret(req)) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		// Get all lists from registry
		const lists = await db.query.callListRegistry.findMany();

		// Get member counts and last sync times for each list
		const listStatuses = await Promise.all(
			lists.map(async (list) => {
				// Count active members
				const activeMembers = await db.query.contactListMemberships.findMany({
					where: and(
						eq(contactListMemberships.agentKey, list.agentKey),
						eq(contactListMemberships.listKey, list.listKey),
						eq(contactListMemberships.status, "active")
					),
				});

				const memberCount = activeMembers.length;

				// Get last sync time (most recent sync_log entry for this list)
				const lastSync = await db.query.syncLog.findFirst({
					where: and(
						eq(syncLog.direction, "ghl_to_aloware"),
						eq(syncLog.entityType, "list"),
						eq(syncLog.status, "success")
					),
					orderBy: (logs, { desc }) => [desc(logs.finishedAt)],
				});

				return {
					agentKey: list.agentKey,
					listKey: list.listKey,
					alowareListId: list.alowareListId,
					alowareListName: list.alowareListName,
					memberCount,
					lastSyncedAt: lastSync?.finishedAt?.toISOString() || null,
					createdAt: list.createdAt.toISOString(),
					updatedAt: list.updatedAt.toISOString(),
				};
			})
		);

		// Get recent errors (last 24 hours)
		const oneDayAgo = new Date();
		oneDayAgo.setDate(oneDayAgo.getDate() - 1);

		const allErrors = await db.query.syncLog.findMany({
			where: and(
				eq(syncLog.entityType, "list"),
				eq(syncLog.status, "error")
			),
			orderBy: (logs, { desc }) => [desc(logs.finishedAt)],
		});

		// Filter to last 24 hours
		const recentErrors = allErrors.filter((error) => {
			if (!error.finishedAt) return false;
			return error.finishedAt >= oneDayAgo;
		}).slice(0, 50);

		return NextResponse.json({
			lists: listStatuses,
			errors: recentErrors.map((error) => ({
				id: error.id,
				entityId: error.entityId,
				errorMessage: error.errorMessage,
				finishedAt: error.finishedAt?.toISOString(),
				correlationId: error.correlationId,
			})),
			summary: {
				totalLists: lists.length,
				totalMembers: listStatuses.reduce((sum, list) => sum + list.memberCount, 0),
				recentErrors: recentErrors.length,
			},
		});
	} catch (error) {
		console.error("[status] Error:", error);
		return NextResponse.json({
			error: error instanceof Error ? error.message : "Unknown error",
		}, { status: 500 });
	}
}

