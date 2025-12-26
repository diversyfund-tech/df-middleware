import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { ensureContactMappingByPhoneOrEmail } from "@/lib/sync/ghl-contact-sync";

export const dynamic = "force-dynamic";

/**
 * Validate admin secret header
 */
function validateAdminSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-ADMIN-SECRET");
	return secret === env.DF_ADMIN_SECRET;
}

/**
 * Repair contact mapping
 * POST /api/admin/mappings/repair?phone=xxx&email=xxx
 */
export async function POST(req: NextRequest) {
	if (!validateAdminSecret(req)) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	try {
		const url = new URL(req.url);
		const phone = url.searchParams.get("phone") || undefined;
		const email = url.searchParams.get("email") || undefined;

		if (!phone && !email) {
			return NextResponse.json(
				{ error: "phone or email parameter required" },
				{ status: 400 }
			);
		}

		const mapping = await ensureContactMappingByPhoneOrEmail(phone, email);

		if (!mapping) {
			return NextResponse.json(
				{ error: "Could not find or create mapping" },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			success: true,
			mapping,
		});
	} catch (error) {
		console.error("[admin/mappings/repair] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}

