/**
 * Manual alert check endpoint
 * 
 * POST /api/alerts/check
 * Manually trigger alert checks
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { runAlertChecks } from "@/lib/alerting";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
	// Verify admin secret
	const authHeader = req.headers.get("authorization");
	const expectedSecret = env.DF_ADMIN_SECRET;

	if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		await runAlertChecks();
		return NextResponse.json({
			success: true,
			message: "Alert checks completed",
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
			},
			{ status: 500 }
		);
	}
}
