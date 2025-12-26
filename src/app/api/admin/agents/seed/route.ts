import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { seedAgentDirectory } from "@/lib/agents/seed";

export const dynamic = "force-dynamic";

/**
 * Validate admin secret
 */
function validateAdminSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-ADMIN-SECRET");
	return secret === env.DF_ADMIN_SECRET;
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

