import { db } from "@/server/db";
import { syncLog } from "@/server/db/schema";
import { syncAlowareContactToGHL } from "./contact-sync";
import { updateContact, addTagsToContact } from "@/lib/ghl/client";
import type { AlowareCall } from "@/lib/aloware/types";

/**
 * Sync Aloware call to GHL
 * Updates GHL contact with call information and adds notes/tags
 */
export async function syncAlowareCallToGHL(
	alowareCall: AlowareCall,
	alowareContact: { id: string; phone_number?: string; email?: string; first_name?: string; last_name?: string },
	correlationId?: string
): Promise<void> {
	const callId = String(alowareCall.id);
	const correlation = correlationId || `call-sync-${Date.now()}`;

	try {
		// First, ensure contact is synced
		const ghlContactId = await syncAlowareContactToGHL(
			{
				id: alowareContact.id,
				phone_number: alowareContact.phone_number,
				email: alowareContact.email,
				first_name: alowareContact.first_name,
				last_name: alowareContact.last_name,
			},
			correlation
		);

		// Build call summary note
		const callNote = buildCallNote(alowareCall);

		// Get existing contact to preserve notes
		const existingContact = await import("@/lib/ghl/client").then(m => m.getContact(ghlContactId));
		const existingNotes = existingContact.notes || "";

		// Update contact with call information
		await updateContact(ghlContactId, {
			notes: existingNotes ? `${existingNotes}\n\n${callNote}` : callNote,
		});

		// Add tags based on call disposition
		if (alowareCall.disposition) {
			await addTagsToContact(ghlContactId, [`Call: ${alowareCall.disposition}`]);
		}

		if (alowareCall.direction === "inbound") {
			await addTagsToContact(ghlContactId, ["Inbound Call"]);
		} else if (alowareCall.direction === "outbound") {
			await addTagsToContact(ghlContactId, ["Outbound Call"]);
		}

		// Log success
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "call",
			entityId: callId,
			sourceId: callId,
			targetId: ghlContactId,
			status: "success",
			finishedAt: new Date(),
			correlationId: correlation,
		});
	} catch (error) {
		console.error("[call-sync] Error syncing call:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Log error
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "call",
			entityId: callId,
			sourceId: callId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId: correlation,
		});

		throw error;
	}
}

/**
 * Build a call note from Aloware call data
 */
function buildCallNote(call: AlowareCall): string {
	const parts: string[] = [];

	parts.push(`Call ${call.direction === "inbound" ? "Received" : "Made"}`);
	
	if (call.created_at) {
		const date = new Date(call.created_at);
		parts.push(`on ${date.toLocaleString()}`);
	}

	if (call.duration) {
		const minutes = Math.floor(call.duration / 60);
		const seconds = call.duration % 60;
		parts.push(`(${minutes}m ${seconds}s)`);
	}

	if (call.disposition) {
		parts.push(`\nDisposition: ${call.disposition}`);
	}

	if (call.status) {
		parts.push(`Status: ${call.status}`);
	}

	if (call.resolution) {
		parts.push(`Resolution: ${call.resolution}`);
	}

	if (call.csat_score !== undefined) {
		parts.push(`CSAT Score: ${call.csat_score}`);
	}

	return parts.join(" ");
}

