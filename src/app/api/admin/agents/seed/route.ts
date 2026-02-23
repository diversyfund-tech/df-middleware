import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { seedAgentDirectory } from "@/lib/agents/seed";
import { db } from "@/server/db";
import { agentDirectory } from "@/server/db/schema";

export const dynamic = "force-dynamic";

/**
 * Validate admin secret
 */
function validateAdminSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-ADMIN-SECRET");
	return secret === env.DF_ADMIN_SECRET;
}

/**
 * Get agent directory (admin endpoint)
 * GET /api/admin/agents/seed
 */
export async function GET(req: NextRequest) {
	if (!validateAdminSecret(req)) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		const agents = await db.query.agentDirectory.findMany({
			orderBy: (agents, { asc }) => [asc(agents.agentKey)],
		});

		return NextResponse.json({
			agents: agents.map((agent) => ({
				id: agent.id,
				agentKey: agent.agentKey,
				displayName: agent.displayName,
				ghlOwnerId: agent.ghlOwnerId,
				ghlOwnerEmail: agent.ghlOwnerEmail,
				ghlAssignedAgentFieldValue: agent.ghlAssignedAgentFieldValue,
				requiredTag: agent.requiredTag,
				alowareUserId: agent.alowareUserId,
				isActive: agent.isActive,
				createdAt: agent.createdAt.toISOString(),
				updatedAt: agent.updatedAt.toISOString(),
			})),
			count: agents.length,
		});
	} catch (error) {
		console.error("[get-agents] Error:", error);
		return NextResponse.json({
			error: error instanceof Error ? error.message : "Unknown error",
		}, { status: 500 });
	}
}

/**
 * Seed agent directory (admin endpoint)
 * POST /api/admin/agents/seed
 */
export async function POST(req: NextRequest) {
	if (!validateAdminSecret(req)) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		const seeded = await seedAgentDirectory();
		return NextResponse.json({
			seeded,
			message: `Seeded ${seeded} new agent(s)`,
		});
	} catch (error) {
		console.error("[seed] Error:", error);
		return NextResponse.json({
			error: error instanceof Error ? error.message : "Unknown error",
		}, { status: 500 });
	}
}

