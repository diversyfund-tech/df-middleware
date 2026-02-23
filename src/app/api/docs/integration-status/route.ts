/**
 * Integration Status API
 * 
 * Returns status of each integration for visual documentation.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { ghlRequest } from "@/lib/ghl/client";
import { getUsers } from "@/lib/aloware/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		const integrations: Record<string, { status: string; message?: string }> = {};

		// Check GHL
		try {
			if (env.GHL_API_KEY || (env.GHL_CLIENT_ID && env.GHL_CLIENT_SECRET)) {
				// Try a simple API call
				try {
					await ghlRequest("GET", "/contacts", { limit: 1 });
					integrations.ghl = { status: "ok" };
				} catch (error) {
					integrations.ghl = {
						status: "warning",
						message: "Configured but connection test failed",
					};
				}
			} else {
				integrations.ghl = { status: "warning", message: "Not configured" };
			}
		} catch (error) {
			integrations.ghl = {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error",
			};
		}

		// Check Aloware
		try {
			if (env.ALOWARE_API_TOKEN) {
				try {
					await getUsers();
					integrations.aloware = { status: "ok" };
				} catch (error) {
					integrations.aloware = {
						status: "warning",
						message: "Configured but connection test failed",
					};
				}
			} else {
				integrations.aloware = { status: "warning", message: "Not configured" };
			}
		} catch (error) {
			integrations.aloware = {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error",
			};
		}

		// Check Verity
		try {
			if (env.VERITY_BASE_URL) {
				integrations.verity = { status: "ok" };
			} else {
				integrations.verity = { status: "warning", message: "Not configured" };
			}
		} catch (error) {
			integrations.verity = {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error",
			};
		}

		return NextResponse.json({
			timestamp: new Date().toISOString(),
			integrations,
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
