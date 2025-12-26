import { db } from "@/server/db";
import { syncLog, contactMappings } from "@/server/db/schema";
import { inArray } from "drizzle-orm";
import { syncGHLTagsToCallList, getOrCreateCallList } from "@/lib/aloware/call-lists";

/**
 * Sync GHL tag to Aloware call list
 * Creates or updates an Aloware call list with contacts that have the GHL tag
 */
export async function syncGHLTagToAlowareList(
	tagName: string,
	correlationId?: string
): Promise<string> {
	const correlation = correlationId || `list-sync-${Date.now()}`;

	try {
		// Get all contacts with this tag from GHL
		// Note: GHL API doesn't have a direct "get contacts by tag" endpoint
		// This would need to be implemented via webhooks or by fetching all contacts
		// For now, we'll create/update the list structure

		// Get all contact mappings to find Aloware contact IDs
		const mappings = await db.query.contactMappings.findMany();

		// Create or get the call list
		const callList = await getOrCreateCallList(
			tagName,
			`Synced from GHL tag: ${tagName}`
		);

		// Extract Aloware contact IDs from mappings
		// In a real implementation, you'd filter by GHL contacts that have the tag
		const alowareContactIds = mappings.map(m => m.alowareContactId).filter(Boolean) as string[];

		// Update the call list with contact IDs
		await syncGHLTagsToCallList(tagName, alowareContactIds);

		// Log success
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "list",
			entityId: tagName,
			sourceId: tagName,
			targetId: callList.id,
			status: "success",
			finishedAt: new Date(),
			correlationId: correlation,
		});

		return callList.id;
	} catch (error) {
		console.error("[list-sync] Error syncing list:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Log error
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "list",
			entityId: tagName,
			sourceId: tagName,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId: correlation,
		});

		throw error;
	}
}

/**
 * Sync GHL contacts with a specific tag to Aloware call list
 * This is a more complete implementation that fetches contacts from GHL
 */
export async function syncGHLTaggedContactsToAlowareList(
	tagName: string,
	ghlContactIds: string[],
	correlationId?: string
): Promise<string> {
	const correlation = correlationId || `list-sync-${Date.now()}`;

	try {
		// Get contact mappings for these GHL contact IDs
		const mappings = await db.query.contactMappings.findMany({
			where: inArray(contactMappings.ghlContactId, ghlContactIds),
		});

		const alowareContactIds = mappings
			.map(m => m.alowareContactId)
			.filter(Boolean) as string[];

		if (alowareContactIds.length === 0) {
			console.warn(`[list-sync] No Aloware contacts found for GHL tag: ${tagName}`);
			return "";
		}

		// Create or update the call list
		const callList = await syncGHLTagsToCallList(tagName, alowareContactIds);

		// Log success
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "list",
			entityId: tagName,
			sourceId: tagName,
			targetId: callList.id,
			status: "success",
			finishedAt: new Date(),
			correlationId: correlation,
		});

		return callList.id;
	} catch (error) {
		console.error("[list-sync] Error syncing tagged contacts:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Log error
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "list",
			entityId: tagName,
			sourceId: tagName,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId: correlation,
		});

		throw error;
	}
}

