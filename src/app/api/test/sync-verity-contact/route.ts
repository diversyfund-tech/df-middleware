import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { textingWebhookEvents, contactMappings } from "@/server/db/schema";
import { sql, or, isNotNull } from "drizzle-orm";
import { syncTextingMessageToGHL } from "@/lib/sync/texting-to-ghl";
import { normalizeTextingWebhook } from "@/lib/texting/normalize";

export const dynamic = "force-dynamic";

/**
 * Test endpoint to sync a Verity contact to GHL
 * 
 * GET /api/test/sync-verity-contact - Get a random contact from message history
 * POST /api/test/sync-verity-contact - Sync a specific contact by phone number
 */
export async function GET(req: NextRequest) {
	try {
		// Get all unique phone numbers from texting webhook events
		const allEvents = await db.query.textingWebhookEvents.findMany({
			where: or(
				isNotNull(textingWebhookEvents.fromNumber),
				isNotNull(textingWebhookEvents.toNumber)
			),
			limit: 100,
		});

		if (allEvents.length === 0) {
			return NextResponse.json({
				error: "No contacts found in texting webhook events",
				suggestion: "Send a test message first using /api/test/texting-webhook",
			}, { status: 404 });
		}

		// Extract unique phone numbers
		const phoneNumbers = new Set<string>();
		for (const event of allEvents) {
			if (event.fromNumber) phoneNumbers.add(event.fromNumber);
			if (event.toNumber) phoneNumbers.add(event.toNumber);
		}

		if (phoneNumbers.size === 0) {
			return NextResponse.json({
				error: "No phone numbers found in texting webhook events",
				suggestion: "Send a test message first using /api/test/texting-webhook",
			}, { status: 404 });
		}

		// Pick a random phone number
		const phoneArray = Array.from(phoneNumbers);
		const phone = phoneArray[Math.floor(Math.random() * phoneArray.length)];

		// Count messages for this phone
		const messageCount = allEvents.filter(
			e => e.fromNumber === phone || e.toNumber === phone
		).length;

		// Check if already synced
		const existingMapping = await db.query.contactMappings.findFirst({
			where: (mappings, { eq }) => eq(mappings.phoneNumber, phone),
		});

		return NextResponse.json({
			phone,
			messageCount,
			alreadySynced: !!existingMapping,
			ghlContactId: existingMapping?.ghlContactId || null,
			nextStep: `POST to this endpoint with {"phone": "${phone}"} to sync to GHL`,
		});
	} catch (error) {
		console.error("[test/sync-verity-contact] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	try {
		const { phone, direction = "inbound", body } = await req.json();

		if (!phone) {
			return NextResponse.json(
				{ error: "phone number is required" },
				{ status: 400 }
			);
		}

		// Create a test message payload simulating Verity webhook
		const testPayload = {
			type: direction === "inbound" ? "message.received" : "message.sent",
			message: {
				id: `test_sync_${Date.now()}`,
				conversationId: `test_conv_${Date.now()}`,
				from: direction === "inbound" ? phone : "+15559876543",
				to: direction === "inbound" ? "+15559876543" : phone,
				body: body || `Test message to sync contact ${phone} to GHL`,
				timestamp: new Date().toISOString(),
				direction,
			},
		};

		// Normalize the payload
		const normalizedPayload = normalizeTextingWebhook(testPayload);

		// Sync to GHL
		const correlationId = `test-sync-${Date.now()}`;
		await syncTextingMessageToGHL(normalizedPayload, { correlationId });

		// Check if contact was created/mapped
		const mapping = await db.query.contactMappings.findFirst({
			where: (mappings, { eq }) => eq(mappings.phoneNumber, phone),
		});

		return NextResponse.json({
			success: true,
			message: `Contact ${phone} synced to GHL`,
			phone,
			ghlContactId: mapping?.ghlContactId || "Check GHL for new contact",
			correlationId,
			note: "Check GHL conversations to see the test message",
		});
	} catch (error) {
		console.error("[test/sync-verity-contact] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

