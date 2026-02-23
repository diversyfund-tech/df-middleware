/**
 * Prometheus metrics endpoint
 * 
 * GET /api/metrics
 * Returns Prometheus metrics in text format
 */

import { NextResponse } from "next/server";
import { register } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const metrics = await register.metrics();
		return new NextResponse(metrics, {
			headers: {
				"Content-Type": register.contentType,
			},
		});
	} catch (error) {
		console.error("[metrics] Error generating metrics:", error);
		return new NextResponse("Error generating metrics", { status: 500 });
	}
}
