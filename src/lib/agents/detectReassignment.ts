import { db } from "@/server/db";
import { contactAgentState, contactListMemberships } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { applyListMembershipChange } from "@/lib/aloware/lists/applyMembership";
import { resolveListKeysForEvent } from "@/lib/lists/resolveListIntent";
import type { GHLContact } from "@/lib/ghl/types";

/**
 * Detect and handle agent reassignment
 * Order is critical:
 * 1. Resolve new agent (already done by caller)
 * 2. Remove from ALL active lists of old agent
 * 3. Resolve current list intent (based on current tags/stage)
 * 4. Apply adds for new agent
 */
export async function detectAndHandleReassignment(
	ghlContactId: string,
	newAgentKey: string,
	contact: GHLContact,
	correlationId: string
): Promise<void> {
	try {
		// Step 1: Check contactAgentState for last known agentKey
		const existingState = await db.query.contactAgentState.findFirst({
			where: eq(contactAgentState.contactId, ghlContactId),
		});

		const oldAgentKey = existingState?.agentKey;

		// If agent hasn't changed, no reassignment needed
		if (oldAgentKey === newAgentKey) {
			// Update state timestamp anyway
			if (existingState) {
				await db
					.update(contactAgentState)
					.set({ updatedAt: new Date() })
					.where(eq(contactAgentState.contactId, ghlContactId));
			} else {
				await db.insert(contactAgentState).values({
					contactId: ghlContactId,
					agentKey: newAgentKey,
				});
			}
			return;
		}

		console.log(`[detectReassignment] Contact ${ghlContactId} reassigned from ${oldAgentKey || "none"} to ${newAgentKey}`);

		// Step 2: Remove contact from ALL active lists for old agent
		if (oldAgentKey) {
			const oldMemberships = await db.query.contactListMemberships.findMany({
				where: and(
					eq(contactListMemberships.contactId, ghlContactId),
					eq(contactListMemberships.agentKey, oldAgentKey),
					eq(contactListMemberships.status, "active")
				),
			});

			const removeListKeys = oldMemberships.map((m) => m.listKey);

			if (removeListKeys.length > 0) {
				await applyListMembershipChange({
					ghlContactId,
					agentKey: oldAgentKey,
					addListKeys: [],
					removeListKeys,
					correlationId: `${correlationId}-reassign-remove`,
				});
			}
		}

		// Step 3: Resolve current list intent (based on current contact state)
		// We need to determine what lists this contact should be in based on their current tags/stage
		const listIntent = await resolveListKeysForEvent("contact.changed", {}, contact);

		// Step 4: Apply adds for new agent using resolved list intent
		if (listIntent.add.length > 0) {
			await applyListMembershipChange({
				ghlContactId,
				agentKey: newAgentKey,
				addListKeys: listIntent.add,
				removeListKeys: [],
				correlationId: `${correlationId}-reassign-add`,
			});
		}

		// Step 5: Update contactAgentState with new agentKey
		if (existingState) {
			await db
				.update(contactAgentState)
				.set({
					agentKey: newAgentKey,
					updatedAt: new Date(),
				})
				.where(eq(contactAgentState.contactId, ghlContactId));
		} else {
			await db.insert(contactAgentState).values({
				contactId: ghlContactId,
				agentKey: newAgentKey,
			});
		}
	} catch (error) {
		console.error(`[detectReassignment] Error handling reassignment for ${ghlContactId}:`, error);
		throw error;
	}
}

