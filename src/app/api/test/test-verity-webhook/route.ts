/**
 * Test Verity Webhook Endpoint
 * 
 * GET /api/test/test-verity-webhook?type=appointment|contact
 * 
 * Tests if Verity's webhook endpoint is accessible and working
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

const VERITY_WEBHOOK_URL = env.VERITY_BASE_URL 
	? `${env.VERITY_BASE_URL}/api/integrations/ghl/webhook`
	: null;
const VERITY_WEBHOOK_SECRET = env.VERITY_WEBHOOK_SECRET;

/**
 * Create HMAC signature for webhook
 */
function createWebhookSignature(body: string, secret: string): string {
	const hmac = createHmac("sha256", secret);
	hmac.update(body);
	return hmac.digest("hex");
}

export async function GET(req: NextRequest) {
	try {
		const testType = req.nextUrl.searchParams.get("type") || "appointment";

		if (!VERITY_WEBHOOK_URL) {
			return NextResponse.json({
				success: false,
				error: "VERITY_BASE_URL is not configured",
				message: "Cannot test - VERITY_BASE_URL environment variable is not set",
			}, { status: 500 });
		}

		let payload: Record<string, unknown>;
		let testName: string;

		switch (testType) {
			case "contact":
				payload = {
					event: "contact.updated",
					id: `test_contact_${Date.now()}`,
					firstName: "Test",
					lastName: "Contact",
					email: `test-${Date.now()}@example.com`,
					phone: "+15551234567",
				};
				testName = "Contact Webhook";
				break;

			case "appointment":
			default:
				payload = {
					event: "appointment.created",
					id: `test_appt_${Date.now()}`,
					contactId: `test_contact_${Date.now()}`,
					startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
					endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
					title: "Test Appointment - Verity Webhook Test",
					calendarId: "61acuXKr2rLLCWn8loyL",
				};
				testName = "Appointment Webhook";
				break;
		}

		const body = JSON.stringify(payload);
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"X-Middleware-Forwarded": "true",
		};

		// Add signature if secret is configured
		if (VERITY_WEBHOOK_SECRET) {
			const signature = createWebhookSignature(body, VERITY_WEBHOOK_SECRET);
			headers["X-Middleware-Secret"] = signature;
		}

		console.log(`[test-verity-webhook] Sending ${testName} to ${VERITY_WEBHOOK_URL}`);

		const response = await fetch(VERITY_WEBHOOK_URL, {
			method: "POST",
			headers,
			body,
		});

		const responseText = await response.text();
		let responseData: unknown;
		try {
			responseData = JSON.parse(responseText);
		} catch {
			responseData = responseText;
		}

		return NextResponse.json({
			success: response.ok,
			testType,
			testName,
			verityWebhookUrl: VERITY_WEBHOOK_URL,
			secretConfigured: !!VERITY_WEBHOOK_SECRET,
			request: {
				method: "POST",
				headers: Object.keys(headers),
				payload,
			},
			response: {
				status: response.status,
				statusText: response.statusText,
				data: responseData,
			},
			message: response.ok
				? `✅ ${testName} successful - Verity accepted the webhook`
				: `❌ ${testName} failed: ${response.status} ${response.statusText}`,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("[test-verity-webhook] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
			},
			{ status: 500 }
		);
	}
}
