/**
 * Test GHL Webhook Endpoint
 * 
 * GET /api/test/test-webhook?type=ping|appointment|contact
 * 
 * Tests the GHL webhook endpoint by sending test payloads
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://df-middleware.vercel.app/api/webhooks/ghl";

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
		const testType = req.nextUrl.searchParams.get("type") || "ping";
		const webhookSecret = env.GHL_WEBHOOK_SECRET;

		let payload: Record<string, unknown>;
		let testName: string;

		switch (testType) {
			case "appointment":
				payload = {
					event: "appointment.created",
					id: `test_appt_${Date.now()}`,
					contactId: `test_contact_${Date.now()}`,
					startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
					endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
					title: "Test Appointment - Webhook Test",
					calendarId: "61acuXKr2rLLCWn8loyL",
				};
				testName = "Appointment Webhook";
				break;

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

			case "ping":
			default:
				payload = { test: "ping" };
				testName = "Ping Test";
				break;
		}

		const body = JSON.stringify(payload);
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		// Add signature if secret is configured
		if (webhookSecret) {
			const signature = createWebhookSignature(body, webhookSecret);
			headers["x-ghl-signature"] = signature;
		}

		console.log(`[test-webhook] Sending ${testName} to ${WEBHOOK_URL}`);

		const response = await fetch(WEBHOOK_URL, {
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
			webhookUrl: WEBHOOK_URL,
			signatureConfigured: !!webhookSecret,
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
				? `✅ ${testName} successful`
				: `❌ ${testName} failed: ${response.status}`,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("[test-webhook] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
			},
			{ status: 500 }
		);
	}
}
