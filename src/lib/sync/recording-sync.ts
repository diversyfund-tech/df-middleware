import { db } from "@/server/db";
import { syncLog, contactMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getContact, updateContact } from "@/lib/ghl/client";
import { getCall } from "@/lib/aloware/client";

/**
 * Sync Recording Saved event to GHL
 * 
 * Adds recording URL to GHL contact notes
 */
export async function syncAlowareRecordingToGHL(
	recordingId: string,
	payload: Record<string, unknown>,
	correlationId: string
): Promise<void> {
	try {
		// Extract call ID and recording URL from payload
		const callId = payload.call_id as string || payload.callId as string || payload.communication_id as string;
		const recordingUrl = payload.url as string || payload.recording_url as string || payload.audio_url as string;

		if (!callId) {
			throw new Error(`No call_id found in recording payload`);
		}

		if (!recordingUrl) {
			console.warn(`[recording-sync] No recording URL found for recording ${recordingId}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "recording",
				entityId: recordingId,
				sourceId: recordingId,
				status: "skipped",
				finishedAt: new Date(),
				errorMessage: "No recording URL in payload",
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
			console.warn(`[recording-sync] No mapping found for Aloware contact ${call.contact_id}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "recording",
				entityId: recordingId,
				sourceId: recordingId,
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

		// Build recording note
		const timestamp = payload.created_at 
			? new Date(payload.created_at as string).toLocaleString()
			: new Date().toLocaleString();
		
		const duration = payload.duration ? ` (${payload.duration}s)` : "";
		const recordingNote = `[RECORDING] ${timestamp}${duration}\nCall ID: ${callId}\nRecording: ${recordingUrl}\n\nSYS:df_middleware_origin`;

		// Update contact with recording
		await updateContact(ghlContactId, {
			notes: existingNotes ? `${existingNotes}\n\n${recordingNote}` : recordingNote,
		});

		// Log success
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "recording",
			entityId: recordingId,
			sourceId: recordingId,
			targetId: ghlContactId,
			status: "success",
			finishedAt: new Date(),
			correlationId,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[recording-sync] Error syncing recording:`, error);

		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "recording",
			entityId: recordingId,
			sourceId: recordingId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

