import { db } from "@/server/db";
import { syncLog, contactMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getContact, updateContact, addTagsToContact } from "@/lib/ghl/client";
import { getCall } from "@/lib/aloware/client";

/**
 * Sync Call Summarized event to GHL
 * 
 * Adds call summary to GHL contact notes and tags key outcomes
 */
export async function syncAlowareCallSummaryToGHL(
	summaryId: string,
	payload: Record<string, unknown>,
	correlationId: string
): Promise<void> {
	try {
		// Extract call ID and summary text from payload
		const callId = payload.call_id as string || payload.callId as string || payload.communication_id as string;
		const summaryText = payload.summary as string || payload.text as string || payload.content as string;

		if (!callId) {
			throw new Error(`No call_id found in call summary payload`);
		}

		if (!summaryText) {
			console.warn(`[call-summary-sync] No summary text found for summary ${summaryId}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "call_summary",
				entityId: summaryId,
				sourceId: summaryId,
				status: "skipped",
				finishedAt: new Date(),
				errorMessage: "No summary text in payload",
				correlationId,
			});
			return;
		}

		// Fetch call to get contact ID
		const call = await getCall(callId);
		if (!call || !call.contact_id) {
			throw new Error(`Call ${callId} not found or has no contact_id`);
		}

		// Find GHL contact via mapping
		const mapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.alowareContactId, call.contact_id),
		});

		if (!mapping) {
			console.warn(`[call-summary-sync] No mapping found for Aloware contact ${call.contact_id}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "call_summary",
				entityId: summaryId,
				sourceId: summaryId,
				status: "skipped",
				finishedAt: new Date(),
				errorMessage: "No contact mapping found",
				correlationId,
			});
			return;
		}

		const ghlContactId = mapping.ghlContactId;

		// Get existing contact to preserve notes
		const existingContact = await getContact(ghlContactId);
		const existingNotes = (existingContact.notes as string) || "";

		// Build summary note
		const timestamp = payload.created_at 
			? new Date(payload.created_at as string).toLocaleString()
			: new Date().toLocaleString();
		
		const summaryNote = `[CALL SUMMARY] ${timestamp}\nCall ID: ${callId}\n\n${summaryText}\n\nSYS:df_middleware_origin`;

		// Update contact with summary
		await updateContact(ghlContactId, {
			notes: existingNotes ? `${existingNotes}\n\n${summaryNote}` : summaryNote,
		});

		// Extract key outcomes/tags from summary if available
		const outcomes = payload.outcomes as string[] || payload.tags as string[] || [];
		if (outcomes.length > 0) {
			await addTagsToContact(ghlContactId, outcomes.map(o => `Summary: ${o}`));
		}

		// Check for common keywords in summary and tag accordingly
		const summaryLower = summaryText.toLowerCase();
		const tagsToAdd: string[] = [];
		if (summaryLower.includes("interested") || summaryLower.includes("want")) {
			tagsToAdd.push("Interested");
		}
		if (summaryLower.includes("follow-up") || summaryLower.includes("callback")) {
			tagsToAdd.push("Follow-up Needed");
		}
		if (summaryLower.includes("not interested") || summaryLower.includes("declined")) {
			tagsToAdd.push("Not Interested");
		}

		if (tagsToAdd.length > 0) {
			await addTagsToContact(ghlContactId, tagsToAdd);
		}

		// Log success
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "call_summary",
			entityId: summaryId,
			sourceId: summaryId,
			targetId: ghlContactId,
			status: "success",
			finishedAt: new Date(),
			correlationId,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[call-summary-sync] Error syncing call summary:`, error);

		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "call_summary",
			entityId: summaryId,
			sourceId: summaryId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

