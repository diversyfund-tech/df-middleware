/**
 * Test Verity Webhook Endpoint
 * 
 * Tests if Verity's webhook endpoint is accessible and working by:
 * 1. Sending test webhook payloads to Verity
 * 2. Checking response status
 * 3. Verifying webhook format
 */

import { env } from "../src/env";
import { createHmac } from "crypto";

const VERITY_WEBHOOK_URL = env.VERITY_BASE_URL 
	? `${env.VERITY_BASE_URL}/api/integrations/ghl/webhook`
	: null;
const VERITY_WEBHOOK_SECRET = env.VERITY_WEBHOOK_SECRET;

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
 * Test Verity webhook with appointment event
 */
async function testAppointmentWebhook(): Promise<TestResult> {
	if (!VERITY_WEBHOOK_URL) {
		return {
			step: "appointment_webhook",
			success: false,
			message: "VERITY_BASE_URL not configured",
			error: "Cannot test - VERITY_BASE_URL is not set",
		};
	}

	try {
		const appointmentId = `test_appt_${Date.now()}`;
		const contactId = `test_contact_${Date.now()}`;

		const payload = {
			event: "appointment.created",
			id: appointmentId,
			contactId: contactId,
			startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
			title: "Test Appointment - Verity Webhook Test",
			calendarId: "61acuXKr2rLLCWn8loyL",
		};

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

		console.log(`[test-verity-webhook] Sending appointment webhook to ${VERITY_WEBHOOK_URL}`);

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

		if (response.ok) {
			return {
				step: "appointment_webhook",
				success: true,
				message: `Verity webhook accepted (${response.status})`,
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
				message: `Verity webhook rejected: ${response.status}`,
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
			message: "Failed to send webhook to Verity",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test Verity webhook with contact event
 */
async function testContactWebhook(): Promise<TestResult> {
	if (!VERITY_WEBHOOK_URL) {
		return {
			step: "contact_webhook",
			success: false,
			message: "VERITY_BASE_URL not configured",
			error: "Cannot test - VERITY_BASE_URL is not set",
		};
	}

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
			"X-Middleware-Forwarded": "true",
		};

		// Add signature if secret is configured
		if (VERITY_WEBHOOK_SECRET) {
			const signature = createWebhookSignature(body, VERITY_WEBHOOK_SECRET);
			headers["X-Middleware-Secret"] = signature;
		}

		console.log(`[test-verity-webhook] Sending contact webhook to ${VERITY_WEBHOOK_URL}`);

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

		if (response.ok) {
			return {
				step: "contact_webhook",
				success: true,
				message: `Verity webhook accepted (${response.status})`,
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
				message: `Verity webhook rejected: ${response.status}`,
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
			message: "Failed to send webhook to Verity",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Test Verity webhook endpoint accessibility
 */
async function testWebhookEndpoint(): Promise<TestResult> {
	if (!VERITY_WEBHOOK_URL) {
		return {
			step: "endpoint_check",
			success: false,
			message: "VERITY_BASE_URL not configured",
			error: "Cannot test - VERITY_BASE_URL is not set",
		};
	}

	try {
		// Try a simple ping to see if endpoint exists
		const response = await fetch(VERITY_WEBHOOK_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ test: "ping" }),
		});

		const responseText = await response.text();

		return {
			step: "endpoint_check",
			success: response.status < 500, // 4xx is OK (means endpoint exists), 5xx is bad
			message: `Endpoint accessible (${response.status})`,
			data: {
				status: response.status,
				response: responseText.substring(0, 200),
			},
		};
	} catch (error) {
		return {
			step: "endpoint_check",
			success: false,
			message: "Failed to reach Verity webhook endpoint",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Main test function
 */
async function testVerityWebhook() {
	const results: TestResult[] = [];

	console.log("\n=== Verity Webhook Test ===\n");
	console.log(`Verity Webhook URL: ${VERITY_WEBHOOK_URL || "NOT CONFIGURED"}`);
	console.log(`Webhook Secret: ${VERITY_WEBHOOK_SECRET ? "✅ Configured" : "⚠️  Not configured"}\n`);

	if (!VERITY_WEBHOOK_URL) {
		console.log("❌ Cannot test - VERITY_BASE_URL is not configured");
		console.log("   Set VERITY_BASE_URL in your environment variables");
		process.exit(1);
	}

	// Test 1: Check endpoint accessibility
	console.log("Test 1: Checking endpoint accessibility...");
	const endpointResult = await testWebhookEndpoint();
	results.push(endpointResult);
	console.log(`${endpointResult.success ? "✅" : "❌"} ${endpointResult.message}`);
	if (endpointResult.error) {
		console.log(`   Error: ${endpointResult.error}`);
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
		const data = appointmentResult.data as { status?: number; appointmentId?: string };
		if (data.status) {
			console.log(`   Status: ${data.status}`);
		}
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
		const data = contactResult.data as { status?: number; contactId?: string };
		if (data.status) {
			console.log(`   Status: ${data.status}`);
		}
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
			const data = result.data as { status?: number };
			if (data.status) {
				console.log(`   Status: ${data.status}`);
			}
		}
		if (result.error) {
			console.log(`   Error: ${result.error}`);
		}
	}

	console.log("\n=== NEXT STEPS ===\n");
	if (successCount === totalTests) {
		console.log("✅ All tests passed! Verity webhook endpoint is working correctly.");
		console.log("\nTo verify Verity processed the webhooks:");
		console.log("1. Check Verity's logs/database to see if events were received");
		console.log("2. Verify Verity's webhook handler processed the events");
		console.log("3. Check if Verity's database was updated (if applicable)");
	} else {
		console.log("⚠️  Some tests failed. Check the errors above.");
		console.log("\nCommon issues:");
		console.log("- VERITY_BASE_URL is incorrect or not accessible");
		console.log("- Verity webhook endpoint doesn't exist or path is wrong");
		console.log("- Webhook secret mismatch (if signature verification is enabled)");
		console.log("- CORS or network issues");
		console.log("- Verity server is down");
	}
}

// Run if executed directly
if (require.main === module) {
	testVerityWebhook()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n=== ERROR ===");
			console.error(error);
			process.exit(1);
		});
}

export { testVerityWebhook };
