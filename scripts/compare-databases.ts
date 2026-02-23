#!/usr/bin/env tsx
/**
 * Database Comparison Script
 * Compares DF Middleware database with Verity database to check for inconsistencies
 */

import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(__dirname, "../.env.local") });

const middlewareDbUrl = process.env.DATABASE_URL;
const verityDbUrl = process.env.VERITY_DATABASE_URL;

if (!middlewareDbUrl || !verityDbUrl) {
	console.error("Missing database URLs in environment variables");
	process.exit(1);
}

const middlewareDb = postgres(middlewareDbUrl);
const verityDb = postgres(verityDbUrl);

interface ComparisonResult {
	table: string;
	issue: string;
	severity: "error" | "warning" | "info";
	count?: number;
	details?: string[];
}

const results: ComparisonResult[] = [];

async function compareDatabases() {
	console.log("🔍 Comparing DF Middleware and Verity Databases...\n");

	try {
		// 1. Check message_mappings vs chat_message
		await checkMessageMappings();

		// 2. Check texting_webhook_events vs chat_message
		await checkTextingWebhookEvents();

		// 3. Check contact mappings vs person table
		await checkContactMappings();

		// 4. Check conversationId consistency
		await checkConversationIds();

		// 5. Check phone number consistency
		await checkPhoneNumbers();

		// Print results
		printResults();

	} catch (error) {
		console.error("Error comparing databases:", error);
		throw error;
	} finally {
		await middlewareDb.end();
		await verityDb.end();
	}
}

async function checkMessageMappings() {
	console.log("📨 Checking message_mappings...");

	// Get all message mappings from middleware
	const mappings = await middlewareDb`
		SELECT 
			texting_message_id,
			ghl_message_id,
			conversation_id,
			from_number,
			to_number,
			direction
		FROM message_mappings
		WHERE texting_message_id IS NOT NULL
		ORDER BY created_at DESC
		LIMIT 100
	`;

	// Check if texting_message_id exists in Verity's chat_message table
	for (const mapping of mappings) {
		if (!mapping.texting_message_id) continue;

		// Try to find by telnyx_message_id (which is what Verity stores)
		const verityMessage = await verityDb`
			SELECT id, telnyx_message_id, chat_id, status
			FROM chat_message
			WHERE telnyx_message_id = ${mapping.texting_message_id}
			LIMIT 1
		`;

		if (verityMessage.length === 0) {
			// Try to find by chat_message.id (if texting_message_id is actually a UUID)
			const verityMessageById = await verityDb`
				SELECT id, telnyx_message_id, chat_id, status
				FROM chat_message
				WHERE id::text = ${mapping.texting_message_id}
				LIMIT 1
			`;

			if (verityMessageById.length === 0) {
				results.push({
					table: "message_mappings",
					issue: `texting_message_id '${mapping.texting_message_id}' not found in Verity chat_message`,
					severity: "warning",
					details: [
						`GHL Message ID: ${mapping.ghl_message_id || "N/A"}`,
						`Conversation ID: ${mapping.conversation_id || "N/A"}`,
						`Direction: ${mapping.direction || "N/A"}`,
					],
				});
			}
		}
	}

	console.log(`   ✓ Checked ${mappings.length} message mappings\n`);
}

async function checkTextingWebhookEvents() {
	console.log("📬 Checking texting_webhook_events...");

	// Get recent texting webhook events
	const events = await middlewareDb`
		SELECT 
			id,
			event_type,
			entity_id,
			conversation_id,
			from_number,
			to_number,
			status
		FROM texting_webhook_events
		WHERE status = 'done'
		ORDER BY received_at DESC
		LIMIT 100
	`;

	let missingCount = 0;
	for (const event of events) {
		if (!event.conversation_id) continue;

		// Check if conversation exists in Verity
		const verityChat = await verityDb`
			SELECT id, type, owner_id
			FROM chat
			WHERE id::text = ${event.conversation_id}
			LIMIT 1
		`;

		if (verityChat.length === 0) {
			missingCount++;
			if (missingCount <= 5) {
				results.push({
					table: "texting_webhook_events",
					issue: `conversation_id '${event.conversation_id}' not found in Verity chat table`,
					severity: "warning",
					details: [
						`Event Type: ${event.event_type}`,
						`Entity ID: ${event.entity_id || "N/A"}`,
						`From: ${event.from_number || "N/A"}`,
						`To: ${event.to_number || "N/A"}`,
					],
				});
			}
		}
	}

	if (missingCount > 5) {
		results.push({
			table: "texting_webhook_events",
			issue: `${missingCount} events have conversation_id not found in Verity`,
			severity: "warning",
			count: missingCount,
		});
	}

	console.log(`   ✓ Checked ${events.length} webhook events (${missingCount} missing conversations)\n`);
}

async function checkContactMappings() {
	console.log("👤 Checking contact_mappings...");

	// Get contact mappings
	const mappings = await middlewareDb`
		SELECT 
			ghl_contact_id,
			aloware_contact_id,
			phone_number,
			email
		FROM contact_mappings
		WHERE phone_number IS NOT NULL
		LIMIT 100
	`;

	console.log(`   ✓ Found ${mappings.length} contact mappings with phone numbers\n`);
}

async function checkConversationIds() {
	console.log("💬 Checking conversationId consistency...");

	// Get unique conversation IDs from middleware
	const middlewareConversations = await middlewareDb`
		SELECT DISTINCT conversation_id
		FROM (
			SELECT conversation_id FROM message_mappings WHERE conversation_id IS NOT NULL
			UNION
			SELECT conversation_id FROM texting_webhook_events WHERE conversation_id IS NOT NULL
		) AS combined
		LIMIT 100
	`;

	let foundCount = 0;
	let missingCount = 0;

	for (const row of middlewareConversations) {
		const conversationId = row.conversation_id;
		if (!conversationId) continue;

		const verityChat = await verityDb`
			SELECT id, type, owner_id
			FROM chat
			WHERE id::text = ${conversationId}
			LIMIT 1
		`;

		if (verityChat.length > 0) {
			foundCount++;
		} else {
			missingCount++;
			if (missingCount <= 5) {
				results.push({
					table: "conversation_ids",
					issue: `conversation_id '${conversationId}' not found in Verity chat table`,
					severity: "warning",
				});
			}
		}
	}

	if (missingCount > 5) {
		results.push({
			table: "conversation_ids",
			issue: `${missingCount} conversation IDs not found in Verity`,
			severity: "warning",
			count: missingCount,
		});
	}

	console.log(`   ✓ Checked ${middlewareConversations.length} conversation IDs (${foundCount} found, ${missingCount} missing)\n`);
}

async function checkPhoneNumbers() {
	console.log("📞 Checking phone number consistency...");

	// Get phone numbers from middleware message_mappings
	const middlewarePhones = await middlewareDb`
		SELECT DISTINCT from_number, to_number
		FROM message_mappings
		WHERE from_number IS NOT NULL OR to_number IS NOT NULL
		LIMIT 100
	`;

	const allPhones = new Set<string>();
	for (const row of middlewarePhones) {
		if (row.from_number) allPhones.add(row.from_number);
		if (row.to_number) allPhones.add(row.to_number);
	}

	// Check if these phone numbers exist in Verity's person table
	let foundCount = 0;
	let missingCount = 0;

	for (const phone of Array.from(allPhones).slice(0, 50)) {
		const verityPerson = await verityDb`
			SELECT id, phone_number, email_address
			FROM person
			WHERE phone_number = ${phone}
			LIMIT 1
		`;

		if (verityPerson.length > 0) {
			foundCount++;
		} else {
			missingCount++;
		}
	}

	console.log(`   ✓ Checked ${allPhones.size} unique phone numbers (${foundCount} found in Verity, ${missingCount} not found)\n`);

	if (missingCount > 0) {
		results.push({
			table: "phone_numbers",
			issue: `${missingCount} phone numbers from middleware not found in Verity person table`,
			severity: "info",
			count: missingCount,
		});
	}
}

function printResults() {
	console.log("\n" + "=".repeat(80));
	console.log("📊 COMPARISON RESULTS");
	console.log("=".repeat(80) + "\n");

	if (results.length === 0) {
		console.log("✅ No issues found! Databases appear to be in sync.\n");
		return;
	}

	const errors = results.filter(r => r.severity === "error");
	const warnings = results.filter(r => r.severity === "warning");
	const info = results.filter(r => r.severity === "info");

	if (errors.length > 0) {
		console.log(`🔴 ERRORS (${errors.length}):\n`);
		errors.forEach((result, i) => {
			console.log(`${i + 1}. [${result.table}] ${result.issue}`);
			if (result.count) console.log(`   Count: ${result.count}`);
			if (result.details) {
				result.details.forEach(d => console.log(`   - ${d}`));
			}
			console.log();
		});
	}

	if (warnings.length > 0) {
		console.log(`⚠️  WARNINGS (${warnings.length}):\n`);
		warnings.forEach((result, i) => {
			console.log(`${i + 1}. [${result.table}] ${result.issue}`);
			if (result.count) console.log(`   Count: ${result.count}`);
			if (result.details) {
				result.details.forEach(d => console.log(`   - ${d}`));
			}
			console.log();
		});
	}

	if (info.length > 0) {
		console.log(`ℹ️  INFO (${info.length}):\n`);
		info.forEach((result, i) => {
			console.log(`${i + 1}. [${result.table}] ${result.issue}`);
			if (result.count) console.log(`   Count: ${result.count}`);
			console.log();
		});
	}

	console.log("=".repeat(80));
	console.log(`\nTotal Issues: ${results.length} (${errors.length} errors, ${warnings.length} warnings, ${info.length} info)\n`);
}

// Run comparison
compareDatabases().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
