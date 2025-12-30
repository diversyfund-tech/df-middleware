import { db } from "@/server/db";
import { syncLog } from "@/server/db/schema";
import {
	enrollContactInSequence,
	disenrollContactFromAllSequences,
	getContactIdByPhone,
	removeContactFromAllLists,
} from "@/lib/aloware/client";
import { getSequenceIdForStatus, isStatusOptional } from "./statusMapping";
import { env } from "@/env";

interface HandleAlowareListStatusChangeParams {
	phoneNumber: string;
	status: string;
	correlationId?: string;
}

/**
 * Handle Aloware list status change by enrolling/disenrolling in sequences
 * 
 * Flow:
 * 1. Guard: If status empty/null → return early (optionally do cleanup)
 * 2. Guard: If status not in mapping → log warning, return
 * 3. Optional cleanup: Look up contact_id, remove from Power Dialer lists
 * 4. Disenroll from all sequences (safe, swallow errors)
 * 5. Enroll into target sequence (get sequence_id from mapping)
 */
export async function handleAlowareListStatusChange(
	params: HandleAlowareListStatusChangeParams
): Promise<void> {
	const { phoneNumber, status, correlationId } = params;

	// TEMPORARILY DISABLED: Check feature flag
	const enableSequences = env.ENABLE_ALOWARE_SEQUENCES === "true"; // Default to false (disabled)
	if (!enableSequences) {
		console.log(`[enrollHandler] Aloware sequences are disabled (ENABLE_ALOWARE_SEQUENCES=false), skipping sequence enrollment for ${phoneNumber}`);
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "sequence",
			entityId: phoneNumber,
			sourceId: phoneNumber,
			status: "skipped",
			finishedAt: new Date(),
			errorMessage: "Aloware sequences are temporarily disabled",
			correlationId,
		});
		return;
	}

	// Normalize phone number
	const normalizedPhone = phoneNumber.replace(/[^\d+]/g, "");

	if (!normalizedPhone) {
		console.warn("[enrollHandler] No phone number provided, skipping sequence enrollment");
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "sequence",
			entityId: normalizedPhone || "unknown",
			sourceId: normalizedPhone || "unknown",
			status: "skipped",
			finishedAt: new Date(),
			errorMessage: "No phone number provided",
			correlationId,
		});
		return;
	}

	// Guard: If status empty/null → return early (optionally do cleanup)
	if (!status || status.trim() === "") {
		console.log("[enrollHandler] Status is empty, skipping sequence enrollment");
		// Optionally do cleanup - remove from Power Dialer lists
		try {
			const contactId = await getContactIdByPhone(normalizedPhone);
			if (contactId) {
				await removeContactFromAllLists(contactId);
				console.log(`[enrollHandler] Removed contact ${contactId} from all Power Dialer lists (status cleared)`);
			}
		} catch (error) {
			console.warn("[enrollHandler] Error during cleanup (swallowed):", error);
		}
		return;
	}

	const statusValue = status.trim();

	// Guard: If status not in mapping → log warning, return
	const sequenceId = getSequenceIdForStatus(statusValue);
	if (!sequenceId) {
		const isOptional = isStatusOptional(statusValue);
		if (isOptional) {
			console.log(`[enrollHandler] Status "${statusValue}" is optional and not configured, skipping`);
		} else {
			console.warn(`[enrollHandler] Status "${statusValue}" not found in ALOWARE_STATUS_TO_SEQUENCE mapping, skipping`);
		}
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "sequence",
			entityId: normalizedPhone,
			sourceId: normalizedPhone,
			status: "skipped",
			finishedAt: new Date(),
			errorMessage: `Status "${statusValue}" not in mapping${isOptional ? " (optional)" : ""}`,
			correlationId,
		});
		return;
	}

	// Optional cleanup: Look up contact_id, remove from Power Dialer lists
	try {
		const contactId = await getContactIdByPhone(normalizedPhone);
		if (contactId) {
			await removeContactFromAllLists(contactId);
			console.log(`[enrollHandler] Removed contact ${contactId} from all Power Dialer lists before sequence enrollment`);
		}
	} catch (error) {
		// Swallow cleanup errors - not critical
		console.warn("[enrollHandler] Error removing from Power Dialer lists (swallowed):", error);
	}

	// Disenroll from all sequences (safe, swallow errors)
	try {
		await disenrollContactFromAllSequences(normalizedPhone);
		console.log(`[enrollHandler] Disenrolled contact ${normalizedPhone} from all sequences`);
	} catch (error) {
		// Swallow disenroll errors - safe operation
		console.warn("[enrollHandler] Error disenrolling from sequences (swallowed):", error);
	}

	// Enroll into target sequence
	try {
		const result = await enrollContactInSequence(normalizedPhone, sequenceId, true);
		console.log(`[enrollHandler] Enrolled contact ${normalizedPhone} in sequence ${sequenceId} (status: ${statusValue})`);
		
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "sequence",
			entityId: normalizedPhone,
			sourceId: normalizedPhone,
			targetId: sequenceId,
			status: "success",
			finishedAt: new Date(),
			errorMessage: result.message,
			correlationId,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[enrollHandler] Error enrolling in sequence ${sequenceId}:`, errorMessage);
		
		await db.insert(syncLog).values({
			direction: "ghl_to_aloware",
			entityType: "sequence",
			entityId: normalizedPhone,
			sourceId: normalizedPhone,
			targetId: sequenceId,
			status: "error",
			finishedAt: new Date(),
			errorMessage: `Failed to enroll: ${errorMessage}`,
			correlationId,
		});
		// Don't throw - graceful degradation
	}
}

