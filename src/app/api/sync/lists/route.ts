import { NextRequest, NextResponse } from "next/server";
import { syncGHLTagToAlowareList } from "@/lib/sync/list-sync";

export const dynamic = "force-dynamic";

/**
 * Manual sync endpoint for call lists
 * POST /api/sync/lists?tagName=xxx
 */
export async function POST(req: NextRequest) {
	try {
		const url = new URL(req.url);
		const tagName = url.searchParams.get("tagName");

		if (!tagName) {
			return NextResponse.json(
				{ error: "tagName query parameter is required" },
				{ status: 400 }
			);
		}

		// Sync GHL tag to Aloware call list
		const callListId = await syncGHLTagToAlowareList(tagName);

		return NextResponse.json({
			success: true,
			tagName,
			callListId,
		});
	} catch (error) {
		console.error("[sync/lists] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

