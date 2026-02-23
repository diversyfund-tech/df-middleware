/**
 * System Status API
 * 
 * Returns aggregated system status for visual documentation.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getBoss } from "@/lib/jobs/boss";
import { env } from "@/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		const components: Record<string, { status: string; message?: string }> = {};
		let allHealthy = true;

		// Check database
		try {
			await db.execute({ sql: "SELECT 1", args: [] });
			components.database = { status: "ok" };
		} catch (error) {
			components.database = {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error",
			};
			allHealthy = false;
		}

		// Check pg-boss
		try {
			const boss = getBoss();
			if (boss) {
				components.jobQueue = { status: "ok" };
			} else {
				components.jobQueue = { status: "warning", message: "Not initialized" };
			}
		} catch (error) {
			components.jobQueue = {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error",
			};
			allHealthy = false;
		}

		// Check Express server (assume ok if we can respond)
		components.express = { status: "ok" };

		// Check Next.js (assume ok if we can respond)
		components.nextjs = { status: "ok" };

		// Check external APIs (configuration check)
		if (env.GHL_API_KEY || (env.GHL_CLIENT_ID && env.GHL_CLIENT_SECRET)) {
			components.ghl = { status: "ok" };
		} else {
			components.ghl = { status: "warning", message: "Not configured" };
		}

		if (env.ALOWARE_API_TOKEN) {
			components.aloware = { status: "ok" };
		} else {
			components.aloware = { status: "warning", message: "Not configured" };
		}

		if (env.VERITY_BASE_URL) {
			components.verity = { status: "ok" };
		} else {
			components.verity = { status: "warning", message: "Not configured" };
		}

		return NextResponse.json({
			status: allHealthy ? "ok" : "degraded",
			timestamp: new Date().toISOString(),
			components,
		});
	} catch (error) {
		return NextResponse.json(
			{
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}
