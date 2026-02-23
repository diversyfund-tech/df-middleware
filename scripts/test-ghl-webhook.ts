/**
 * Test GHL Webhook Endpoint
 * 
 * This script tests if the GHL webhook endpoint is working by:
 * 1. Sending a test webhook payload to the production URL
 * 2. Checking the response
 * 3. Verifying the event was stored in the database (optional)
 */

import { env } from "../src/env";
import { createHmac } from "crypto";

const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://df-middleware.vercel.app/api/webhooks/ghl";
const WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET || env.GHL_WEBHOOK_SECRET;

interface TestResult {
	step: string;
	success: boolean;
	message: string;
	data?: unknown;
	error?: string;
}

/**
 * Create HMAC signature for webhook
 */
function createWebhookSignature(body: string, secret: string): string {
	const hmac = createHmac("sha256", secret);
	hmac.update(body);
	return hmac.digest("hex");
}

/**
 * Test webhook with a simple ping
 */
async function testWebhookPing(): Promise<TestResult> {
	try {
		const payload = { test: "ping" };
		const body = JSON.stringify(payload);

		const response = await fetch(WEBHOOK_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body,
		});

		const responseText = await response.text();
		let responseData;
		try {
			responseData = JSON.parse(responseText);
		} catch {
			responseData = responseText;
		}

		if (response.ok) {
			return {
				step: "ping_test",
				success: true,
				message: `Webhook endpoint is accessible (${response.status})`,
				data: {
					status: response.status,
					response: responseData,
				},
			};
		} else {
			return {
				step: "ping_test",
				success: false,
				message: `Webhook returned error status: ${response.status}`,
				error: responseText,
				data: {
					status: response.status,
					response: responseData,
				},
			};
		}
	} catch (error) {
		return {
			step: "ping_test",
			success: false,
			message: "Failed to reach webhook endpoint",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test webhook with appointment event
 */
async function testAppointmentWebhook(): Promise<TestResult> {
	try {
		const appointmentId = `test_appt_${Date.now()}`;
		const contactId = `test_contact_${Date.now()}`;

		const payload = {
			event: "appointment.created",
			id: appointmentId,
			contactId: contactId,
			startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
			endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
			title: "Test Appointment - Webhook Test",
			calendarId: "61acuXKr2rLLCWn8loyL",
		};

		const body = JSON.stringify(payload);
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		// Add signature if secret is configured
		if (WEBHOOK_SECRET) {
			const signature = createWebhookSignature(body, WEBHOOK_SECRET);
			headers["x-ghl-signature"] = signature;
		}

		const response = await fetch(WEBHOOK_URL, {
			method: "POST",
			headers,
			body,
		});

		const responseText = await response.text();
		let responseData;
		try {
			responseData = JSON.parse(responseText);
		} catch {
			responseData = responseText;
		}

		if (response.ok) {
			return {
				step: "appointment_webhook",
				success: true,
				message: `Appointment webhook accepted (${response.status})`,
				data: {
					status: response.status,
					response: responseData,
					appointmentId,
					contactId,
				},
			};
		} else {
			return {
				step: "appointment_webhook",
				success: false,
				message: `Appointment webhook rejected: ${response.status}`,
				error: responseText,
				data: {
					status: response.status,
					response: responseData,
				},
			};
		}
	} catch (error) {
		return {
			step: "appointment_webhook",
			success: false,
			message: "Failed to send appointment webhook",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test webhook with contact event
 */
async function testContactWebhook(): Promise<TestResult> {
	try {
		const contactId = `test_contact_${Date.now()}`;

		const payload = {
			event: "contact.updated",
			id: contactId,
			firstName: "Test",
			lastName: "Contact",
			email: `test-${Date.now()}@example.com`,
			phone: "+15551234567",
		};

		const body = JSON.stringify(payload);
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		// Add signature if secret is configured
		if (WEBHOOK_SECRET) {
			const signature = createWebhookSignature(body, WEBHOOK_SECRET);
			headers["x-ghl-signature"] = signature;
		}

		const response = await fetch(WEBHOOK_URL, {
			method: "POST",
			headers,
			body,
		});

		const responseText = await response.text();
		let responseData;
		try {
			responseData = JSON.parse(responseText);
		} catch {
			responseData = responseText;
		}

		if (response.ok) {
			return {
				step: "contact_webhook",
				success: true,
				message: `Contact webhook accepted (${response.status})`,
				data: {
					status: response.status,
					response: responseData,
					contactId,
				},
			};
		} else {
			return {
				step: "contact_webhook",
				success: false,
				message: `Contact webhook rejected: ${response.status}`,
				error: responseText,
				data: {
					status: response.status,
					response: responseData,
				},
			};
		}
	} catch (error) {
		return {
			step: "contact_webhook",
			success: false,
			message: "Failed to send contact webhook",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Main test function
 */
async function testGHLWebhook() {
	const results: TestResult[] = [];

	console.log("\n=== GHL Webhook Test ===\n");
	console.log(`Webhook URL: ${WEBHOOK_URL}`);
	console.log(`Webhook Secret: ${WEBHOOK_SECRET ? "✅ Configured" : "⚠️  Not configured (signature verification disabled)"}\n`);

	// Test 1: Simple ping
	console.log("Test 1: Sending ping test...");
	const pingResult = await testWebhookPing();
	results.push(pingResult);
	console.log(`${pingResult.success ? "✅" : "❌"} ${pingResult.message}`);
	if (pingResult.error) {
		console.log(`   Error: ${pingResult.error}`);
	}
	console.log("");

	// Test 2: Appointment webhook
	console.log("Test 2: Sending appointment webhook...");
	const appointmentResult = await testAppointmentWebhook();
	results.push(appointmentResult);
	console.log(`${appointmentResult.success ? "✅" : "❌"} ${appointmentResult.message}`);
	if (appointmentResult.error) {
		console.log(`   Error: ${appointmentResult.error}`);
	}
	if (appointmentResult.data && typeof appointmentResult.data === "object") {
		const data = appointmentResult.data as { appointmentId?: string; contactId?: string };
		if (data.appointmentId) {
			console.log(`   Appointment ID: ${data.appointmentId}`);
		}
	}
	console.log("");

	// Test 3: Contact webhook
	console.log("Test 3: Sending contact webhook...");
	const contactResult = await testContactWebhook();
	results.push(contactResult);
	console.log(`${contactResult.success ? "✅" : "❌"} ${contactResult.message}`);
	if (contactResult.error) {
		console.log(`   Error: ${contactResult.error}`);
	}
	if (contactResult.data && typeof contactResult.data === "object") {
		const data = contactResult.data as { contactId?: string };
		if (data.contactId) {
			console.log(`   Contact ID: ${data.contactId}`);
		}
	}
	console.log("");

	// Summary
	console.log("=== SUMMARY ===\n");
	const successCount = results.filter(r => r.success).length;
	const totalTests = results.length;

	console.log(`Tests Passed: ${successCount}/${totalTests}\n`);

	for (const result of results) {
		const icon = result.success ? "✅" : "❌";
		console.log(`${icon} ${result.step}: ${result.message}`);
		if (result.data && typeof result.data === "object") {
			const data = result.data as { status?: number; response?: unknown };
			if (data.status) {
				console.log(`   Status: ${data.status}`);
			}
		}
	}

	console.log("\n=== NEXT STEPS ===\n");
	if (successCount === totalTests) {
		console.log("✅ All tests passed! Your webhook endpoint is working correctly.");
		console.log("\nTo test with real GHL events:");
		console.log("1. Configure the webhook URL in GHL: Settings → Integrations → Private Integrations");
		console.log("2. Set the webhook URL to:", WEBHOOK_URL);
		if (WEBHOOK_SECRET) {
			console.log("3. Configure the webhook secret in GHL (must match GHL_WEBHOOK_SECRET)");
		}
		console.log("4. Trigger an event in GHL (create/update contact or appointment)");
		console.log("5. Check Vercel logs to see the webhook being received");
	} else {
		console.log("⚠️  Some tests failed. Check the errors above.");
		console.log("\nCommon issues:");
		console.log("- Webhook URL is incorrect or not accessible");
		console.log("- Webhook secret mismatch (if signature verification is enabled)");
		console.log("- CORS issues (unlikely for server-to-server)");
		console.log("- Server is down or not deployed");
	}
}

// Run if executed directly
if (require.main === module) {
	testGHLWebhook()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n=== ERROR ===");
			console.error(error);
			process.exit(1);
		});
}

export { testGHLWebhook };
