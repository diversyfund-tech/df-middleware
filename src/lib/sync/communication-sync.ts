import { db } from "@/server/db";
import { syncLog, contactMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getContact, updateContact } from "@/lib/ghl/client";

/**
 * Sync Communication Initiated/Disposed events to GHL
 * 
 * Logs communication attempts/outcomes as lightweight notes
 * Initially stored + skipped, but can be enhanced for analytics
 */
export async function syncAlowareCommunicationToGHL(
	communicationId: string,
	eventType: "initiated" | "disposed",
	payload: Record<string, unknown>,
	correlationId: string
): Promise<void> {
	try {
		// Extract contact ID from payload
		const contactId = payload.contact_id as string || payload.contactId as string;
		if (!contactId) {
			console.warn(`[communication-sync] No contact_id found for communication ${communicationId}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "communication",
				entityId: communicationId,
				sourceId: communicationId,
				status: "skipped",
				finishedAt: new Date(),
				errorMessage: "No contact_id in payload",
				correlationId,
			});
			return;
		}

		// Find GHL contact via mapping
		const mapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.alowareContactId, contactId),
		});

		if (!mapping) {
			console.warn(`[communication-sync] No mapping found for Aloware contact ${contactId}`);
			await db.insert(syncLog).values({
				direction: "aloware_to_ghl",
				entityType: "communication",
				entityId: communicationId,
				sourceId: communicationId,
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

		// Build communication note
		const timestamp = payload.created_at || payload.timestamp
			? new Date((payload.created_at || payload.timestamp) as string).toLocaleString()
			: new Date().toLocaleString();
		
		const channel = payload.channel as string || payload.type as string || "unknown";
		const outcome = eventType === "disposed" 
			? (payload.outcome as string || payload.status as string || "completed")
			: "initiated";

		const communicationNote = `[COMMUNICATION ${eventType.toUpperCase()}] ${timestamp}\nChannel: ${channel}\nOutcome: ${outcome}\n\nSYS:df_middleware_origin`;

		// Update contact with communication note (lightweight)
		await updateContact(ghlContactId, {
			notes: existingNotes ? `${existingNotes}\n\n${communicationNote}` : communicationNote,
		});

		// Log success
		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "communication",
			entityId: communicationId,
			sourceId: communicationId,
			targetId: ghlContactId,
			status: "success",
			finishedAt: new Date(),
			errorMessage: `Communication ${eventType}`,
			correlationId,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[communication-sync] Error syncing communication:`, error);

		await db.insert(syncLog).values({
			direction: "aloware_to_ghl",
			entityType: "communication",
			entityId: communicationId,
			sourceId: communicationId,
			status: "error",
			finishedAt: new Date(),
			errorMessage,
			correlationId,
		});

		throw error;
	}
}

