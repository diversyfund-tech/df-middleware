/**
 * Check Recent Webhook Events
 * 
 * GET /api/test/check-webhooks?limit=20&source=ghl
 * 
 * Shows recent webhook events from the database
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
		const source = req.nextUrl.searchParams.get("source") || "ghl";
		const contactId = req.nextUrl.searchParams.get("contactId");

		let query = db
			.select()
			.from(webhookEvents)
			.orderBy(desc(webhookEvents.receivedAt))
			.limit(limit);

		if (source) {
			query = query.where(eq(webhookEvents.source, source)) as typeof query;
		}

		const events = await query;

		// Format events for response
		const formattedEvents = events.map(event => ({
			id: event.id,
			source: event.source,
			eventType: event.eventType,
			entityType: event.entityType,
			entityId: event.entityId,
			status: event.status,
			receivedAt: event.receivedAt instanceof Date
				? event.receivedAt.toISOString()
				: new Date(event.receivedAt).toISOString(),
			processedAt: event.processedAt
				? (event.processedAt instanceof Date
					? event.processedAt.toISOString()
					: new Date(event.processedAt).toISOString())
				: null,
			dedupeKey: event.dedupeKey,
			errorMessage: event.errorMessage,
		}));

		// Summary statistics
		const statusCounts = events.reduce((acc, event) => {
			acc[event.status] = (acc[event.status] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		// Filter by contactId if provided
		let filteredEvents = formattedEvents;
		if (contactId) {
			filteredEvents = formattedEvents.filter(e => e.entityId === contactId);
		}

		return NextResponse.json({
			success: true,
			total: formattedEvents.length,
			filtered: contactId ? filteredEvents.length : formattedEvents.length,
			statusCounts,
			events: filteredEvents,
			summary: {
				done: statusCounts.done || 0,
				pending: statusCounts.pending || 0,
				processing: statusCounts.processing || 0,
				error: statusCounts.error || 0,
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("[check-webhooks] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
			},
			{ status: 500 }
		);
	}
}
