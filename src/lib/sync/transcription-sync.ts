import { db } from "@/server/db";
import { syncLog, contactMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getContact, updateContact } from "@/lib/ghl/client";
import { getCall } from "@/lib/aloware/client";

/**
 * Sync Transcription Saved event to GHL
 * 
 * Adds transcription text to GHL contact notes
 */
export async function syncAlowareTranscriptionToGHL(
	transcriptionId: string,
	payload: Record<string, unknown>,
	correlationId: string
): Promise<void> {
	try {
		// Extract call ID and transcription text from payload
		const callId = payload.call_id as string || payload.callId as string || payload.communication_id as string;
		const transcriptText = payload.text as string || payload.transcript as string || payload.transcription as string;

		if (!callId) {
			throw new Error(`No call_id found in transcription payload`);
		}

		if (!transcriptText) {
			console.warn(`[transcription-sync] No transcript text found for transcription ${transcriptionId}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "transcription",
				entityId: transcriptionId,
				sourceId: transcriptionId,
				status: "skipped",
				finishedAt: new Date(),
				errorMessage: "No transcript text in payload",
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
			console.warn(`[transcription-sync] No mapping found for Aloware contact ${call.contact_id}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "transcription",
				entityId: transcriptionId,
				sourceId: transcriptionId,
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

		// Build transcription note
		const timestamp = payload.created_at 
			? new Date(payload.created_at as string).toLocaleString()
			: new Date().toLocaleString();
		
		const transcriptionNote = `[TRANSCRIPTION] ${timestamp}\nCall ID: ${callId}\n\n${transcriptText}\n\nSYS:df_middleware_origin`;

		// Update contact with transcription
		await updateContact(ghlContactId, {
			notes: existingNotes ? `${existingNotes}\n\n${transcriptionNote}` : transcriptionNote,
		});

		// Log success
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "transcription",
			entityId: transcriptionId,
			sourceId: transcriptionId,
			targetId: ghlContactId,
			status: "success",
			finishedAt: new Date(),
			correlationId,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[transcription-sync] Error syncing transcription:`, error);

		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "transcription",
			entityId: transcriptionId,
			sourceId: transcriptionId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

