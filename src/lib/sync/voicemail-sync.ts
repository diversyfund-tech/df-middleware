import { db } from "@/server/db";
import { syncLog, contactMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getContact, updateContact } from "@/lib/ghl/client";
import { getCall } from "@/lib/aloware/client";

/**
 * Sync Voicemail Saved event to GHL
 * 
 * Adds voicemail link to GHL contact notes
 */
export async function syncAlowareVoicemailToGHL(
	voicemailId: string,
	payload: Record<string, unknown>,
	correlationId: string
): Promise<void> {
	try {
		// Extract call ID and voicemail URL from payload
		const callId = payload.call_id as string || payload.callId as string || payload.communication_id as string;
		const voicemailUrl = payload.url as string || payload.voicemail_url as string || payload.audio_url as string;

		if (!callId) {
			throw new Error(`No call_id found in voicemail payload`);
		}

		if (!voicemailUrl) {
			console.warn(`[voicemail-sync] No voicemail URL found for voicemail ${voicemailId}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "voicemail",
				entityId: voicemailId,
				sourceId: voicemailId,
				status: "skipped",
				finishedAt: new Date(),
				errorMessage: "No voicemail URL in payload",
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
			console.warn(`[voicemail-sync] No mapping found for Aloware contact ${call.contact_id}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "voicemail",
				entityId: voicemailId,
				sourceId: voicemailId,
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

		// Build voicemail note
		const timestamp = payload.created_at 
			? new Date(payload.created_at as string).toLocaleString()
			: new Date().toLocaleString();
		
		const duration = payload.duration ? ` (${payload.duration}s)` : "";
		const voicemailNote = `[VOICEMAIL] ${timestamp}${duration}\nCall ID: ${callId}\nVoicemail: ${voicemailUrl}\n\nSYS:df_middleware_origin`;

		// Update contact with voicemail
		await updateContact(ghlContactId, {
			notes: existingNotes ? `${existingNotes}\n\n${voicemailNote}` : voicemailNote,
		});

		// Log success
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "voicemail",
			entityId: voicemailId,
			sourceId: voicemailId,
			targetId: ghlContactId,
			status: "success",
			finishedAt: new Date(),
			correlationId,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[voicemail-sync] Error syncing voicemail:`, error);

		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "voicemail",
			entityId: voicemailId,
			sourceId: voicemailId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

