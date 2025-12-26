import { NextRequest, NextResponse } from "next/server";
import { syncAlowareContactToGHL } from "@/lib/sync/contact-sync";
import { getContact } from "@/lib/aloware/client";

export const dynamic = "force-dynamic";

/**
 * Manual sync endpoint for contacts
 * POST /api/sync/contacts?alowareContactId=xxx
 */
export async function POST(req: NextRequest) {
	try {
		const url = new URL(req.url);
		const alowareContactId = url.searchParams.get("alowareContactId");

		if (!alowareContactId) {
			return NextResponse.json(
				{ error: "alowareContactId query parameter is required" },
				{ status: 400 }
			);
		}

		// Fetch contact from Aloware
		const contact = await getContact(alowareContactId);
		if (!contact) {
			return NextResponse.json(
				{ error: `Contact ${alowareContactId} not found in Aloware` },
				{ status: 404 }
			);
		}

		// Sync to GHL
		const ghlContactId = await syncAlowareContactToGHL(contact);

		return NextResponse.json({
			success: true,
			alowareContactId,
			ghlContactId,
		});
	} catch (error) {
		console.error("[sync/contacts] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

