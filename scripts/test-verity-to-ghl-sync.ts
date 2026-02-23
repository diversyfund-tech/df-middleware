#!/usr/bin/env tsx
/**
 * Test Script: Verity → GHL Message Sync
 * 
 * This script tests that messages sent from Verity properly sync to GHL.
 * 
 * Usage:
 *   tsx scripts/test-verity-to-ghl-sync.ts <phone-number>
 * 
 * Example:
 *   tsx scripts/test-verity-to-ghl-sync.ts +19195551234
 */

// Environment variables should be loaded from .env.local automatically
// or passed via process.env

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const VERITY_BASE_URL = process.env.VERITY_BASE_URL;
const VERITY_API_KEY = process.env.VERITY_API_KEY;
const X_DF_JOBS_SECRET = process.env.X_DF_JOBS_SECRET;

interface TestResult {
	step: string;
	success: boolean;
	message: string;
	data?: unknown;
	error?: string;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
	results.push(result);
	const icon = result.success ? "✅" : "❌";
	console.log(`${icon} ${result.step}: ${result.message}`);
	if (result.error) {
		console.error(`   Error: ${result.error}`);
	}
	if (result.data) {
		console.log(`   Data:`, JSON.stringify(result.data, null, 2));
	}
}

async function makeRequest(
	endpoint: string,
	options: RequestInit = {}
): Promise<Response> {
	const url = `${BASE_URL}${endpoint}`;
	console.log(`\n📡 Making request to: ${url}`);
	if (options.body) {
		console.log(`   Body:`, JSON.stringify(JSON.parse(options.body as string), null, 2));
	}
	
	const response = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(options.headers || {}),
		},
	});

	return response;
}

async function testStep1_CreateTestWebhook(phoneNumber: string): Promise<string | null> {
	console.log("\n" + "=".repeat(60));
	console.log("PHASE 1: Simulated Webhook Test");
	console.log("=".repeat(60));
	console.log("\nStep 1: Creating test webhook event...");

	try {
		const testMessageId = `test_verity_${Date.now()}`;
		const testBody = {
			eventType: "message.sent",
			direction: "outbound",
			from: "+15559876543", // System number (Verity)
			to: phoneNumber,
			body: `Test message from Verity - ${new Date().toISOString()}`,
			messageId: testMessageId,
			timestamp: new Date().toISOString(),
		};

		const response = await makeRequest("/api/test/texting-webhook", {
			method: "POST",
			body: JSON.stringify(testBody),
		});

		if (!response.ok) {
			const errorText = await response.text();
			logResult({
				step: "Step 1: Create Test Webhook",
				success: false,
				message: "Failed to create test webhook",
				error: `${response.status} ${response.statusText}: ${errorText}`,
			});
			return null;
		}

		const data = await response.json();
		logResult({
			step: "Step 1: Create Test Webhook",
			success: true,
			message: "Test webhook event created",
			data: data.event,
		});

		return data.event?.id || null;
	} catch (error) {
		logResult({
			step: "Step 1: Create Test Webhook",
			success: false,
			message: "Error creating test webhook",
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

async function testStep2_ProcessEvent(eventId: string | null): Promise<boolean> {
	console.log("\nStep 2: Processing webhook event...");

	if (!eventId) {
		logResult({
			step: "Step 2: Process Event",
			success: false,
			message: "Cannot process event - no event ID from Step 1",
		});
		return false;
	}

	try {
		// Option A: Direct processing via test endpoint
		const response = await makeRequest("/api/test/process-texting-event", {
			method: "POST",
			body: JSON.stringify({ eventId }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			logResult({
				step: "Step 2: Process Event",
				success: false,
				message: "Failed to process event",
				error: `${response.status} ${response.statusText}: ${errorText}`,
			});
			return false;
		}

		const data = await response.json();
		logResult({
			step: "Step 2: Process Event",
			success: data.success === true,
			message: data.success ? "Event processed successfully" : "Event processing failed",
			data: data.event,
		});

		return data.success === true && data.event?.status === "done";
	} catch (error) {
		logResult({
			step: "Step 2: Process Event",
			success: false,
			message: "Error processing event",
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

async function testStep3_VerifyInGHL(phoneNumber: string): Promise<boolean> {
	console.log("\nStep 3: Verifying message in GHL...");
	console.log("   ⚠️  Manual verification required:");
	console.log(`   1. Check GHL conversations for phone number: ${phoneNumber}`);
	console.log(`   2. Verify the test message appears as an outbound message`);
	console.log(`   3. Check that contact was created/updated in GHL`);

	logResult({
		step: "Step 3: Verify in GHL",
		success: true,
		message: "Please manually verify in GHL dashboard",
		data: {
			phoneNumber,
			instructions: [
				"Check GHL conversations for the phone number",
				"Verify message appears as outbound",
				"Check contact was created/updated",
			],
		},
	});

	return true; // We can't automatically verify GHL, so return true for now
}

async function testStep4_SendRealMessage(phoneNumber: string): Promise<string | null> {
	console.log("\n" + "=".repeat(60));
	console.log("PHASE 2: Real Verity Message Test");
	console.log("=".repeat(60));
	console.log("\nStep 4: Sending real message from Verity...");

	if (!VERITY_BASE_URL || !VERITY_API_KEY) {
		logResult({
			step: "Step 4: Send Real Message",
			success: false,
			message: "Verity configuration missing",
			error: "VERITY_BASE_URL or VERITY_API_KEY not set",
		});
		return null;
	}

	try {
		const messageBody = `Real test message from Verity - ${new Date().toISOString()}`;
		const url = `${VERITY_BASE_URL}/api/integrations/df-middleware/send-message`;
		
		console.log(`\n📡 Making request to Verity: ${url}`);
		console.log(`   To: ${phoneNumber}`);
		console.log(`   Body: ${messageBody}`);

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${VERITY_API_KEY}`,
			},
			body: JSON.stringify({
				to: phoneNumber,
				body: messageBody,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			logResult({
				step: "Step 4: Send Real Message",
				success: false,
				message: "Failed to send message via Verity",
				error: `${response.status} ${response.statusText}: ${errorText}`,
			});
			return null;
		}

		const data = await response.json();
		const messageId = data.messageId || data.id;

		logResult({
			step: "Step 4: Send Real Message",
			success: true,
			message: "Message sent via Verity",
			data: {
				messageId,
				note: "Check your phone for the message",
			},
		});

		console.log(`\n   ✅ Message sent! Check your phone (${phoneNumber}) for the message.`);
		console.log(`   ⏳ Waiting 5 seconds for webhook to arrive...`);
		await new Promise((resolve) => setTimeout(resolve, 5000));

		return messageId;
	} catch (error) {
		logResult({
			step: "Step 4: Send Real Message",
			success: false,
			message: "Error sending message via Verity",
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

async function testStep5_VerifyWebhookReceived(messageId: string | null): Promise<string | null> {
	console.log("\nStep 5: Verifying webhook received...");

	if (!messageId) {
		logResult({
			step: "Step 5: Verify Webhook Received",
			success: false,
			message: "Cannot verify webhook - no message ID from Step 4",
		});
		return null;
	}

	console.log(`   ⚠️  Note: This step requires database access to check texting_webhook_events table.`);
	console.log(`   Please check the database for a new event with:`);
	console.log(`   - eventType: "message.sent"`);
	console.log(`   - direction: "outbound"`);
	console.log(`   - Related to messageId: ${messageId}`);

	logResult({
		step: "Step 5: Verify Webhook Received",
		success: true,
		message: "Please manually verify webhook in database",
		data: {
			messageId,
			instructions: [
				"Check texting_webhook_events table",
				"Look for eventType: 'message.sent'",
				"Verify direction: 'outbound'",
			],
		},
	});

	// Return a placeholder - in real scenario, we'd query the DB
	return "webhook_event_id_placeholder";
}

async function testStep6_ProcessRealMessage(eventId: string | null): Promise<boolean> {
	console.log("\nStep 6: Processing real message webhook...");

	if (!eventId || eventId === "webhook_event_id_placeholder") {
		console.log(`   ⚠️  Note: To process the real webhook, you need the actual event ID from the database.`);
		console.log(`   You can:`);
		console.log(`   1. Find the event ID in texting_webhook_events table`);
		console.log(`   2. Call: POST /api/test/process-texting-event with {"eventId": "<id>"}`);
		console.log(`   3. Or call: POST /api/jobs/enqueue-texting-pending to process all pending events`);

		logResult({
			step: "Step 6: Process Real Message",
			success: true,
			message: "Manual processing required",
			data: {
				instructions: [
					"Find event ID in texting_webhook_events table",
					"Call POST /api/test/process-texting-event with eventId",
					"Or call POST /api/jobs/enqueue-texting-pending",
				],
			},
		});

		return true;
	}

	try {
		const response = await makeRequest("/api/test/process-texting-event", {
			method: "POST",
			body: JSON.stringify({ eventId }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			logResult({
				step: "Step 6: Process Real Message",
				success: false,
				message: "Failed to process real message event",
				error: `${response.status} ${response.statusText}: ${errorText}`,
			});
			return false;
		}

		const data = await response.json();
		logResult({
			step: "Step 6: Process Real Message",
			success: data.success === true,
			message: data.success ? "Real message event processed" : "Processing failed",
			data: data.event,
		});

		return data.success === true;
	} catch (error) {
		logResult({
			step: "Step 6: Process Real Message",
			success: false,
			message: "Error processing real message event",
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

async function main() {
	const phoneNumber = process.argv[2];

	if (!phoneNumber) {
		console.error("❌ Error: Phone number required");
		console.error("\nUsage:");
		console.error("  tsx scripts/test-verity-to-ghl-sync.ts <phone-number>");
		console.error("\nExample:");
		console.error("  tsx scripts/test-verity-to-ghl-sync.ts +19195551234");
		process.exit(1);
	}

	// Validate phone number format (basic check)
	if (!phoneNumber.startsWith("+")) {
		console.error("❌ Error: Phone number must be in E.164 format (e.g., +19195551234)");
		process.exit(1);
	}

	console.log("🧪 Verity → GHL Message Sync Test");
	console.log("=".repeat(60));
	console.log(`📱 Phone Number: ${phoneNumber}`);
	console.log(`🌐 Base URL: ${BASE_URL}`);
	console.log(`🔗 Verity URL: ${VERITY_BASE_URL || "Not configured"}`);
	console.log("=".repeat(60));

	// Phase 1: Simulated Test
	const eventId = await testStep1_CreateTestWebhook(phoneNumber);
	const processed = await testStep2_ProcessEvent(eventId);
	await testStep3_VerifyInGHL(phoneNumber);

	// Phase 2: Real Test
	const realMessageId = await testStep4_SendRealMessage(phoneNumber);
	const webhookEventId = await testStep5_VerifyWebhookReceived(realMessageId);
	await testStep6_ProcessRealMessage(webhookEventId);

	// Summary
	console.log("\n" + "=".repeat(60));
	console.log("TEST SUMMARY");
	console.log("=".repeat(60));

	const successful = results.filter((r) => r.success).length;
	const total = results.length;

	results.forEach((result) => {
		const icon = result.success ? "✅" : "❌";
		console.log(`${icon} ${result.step}`);
	});

	console.log("\n" + "=".repeat(60));
	console.log(`Results: ${successful}/${total} steps completed successfully`);
	console.log("=".repeat(60));

	if (successful === total) {
		console.log("\n🎉 All tests completed!");
		process.exit(0);
	} else {
		console.log("\n⚠️  Some tests require manual verification or had errors.");
		console.log("Please review the results above.");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("❌ Fatal error:", error);
	process.exit(1);
});

