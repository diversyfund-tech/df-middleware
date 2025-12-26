import { db } from "@/server/db";
import { callListRegistry } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { createCallList } from "@/lib/aloware/client";

/**
 * Ensure a call list exists in Aloware for the given agent/listKey combination
 * Returns the Aloware list ID (creates if needed)
 */
export async function ensureCallList(
	agentKey: string,
	listKey: string
): Promise<string> {
	// Check if registry entry exists
	const existing = await db.query.callListRegistry.findFirst({
		where: and(
			eq(callListRegistry.agentKey, agentKey),
			eq(callListRegistry.listKey, listKey)
		),
	});

	if (existing?.alowareListId) {
		return existing.alowareListId;
	}

	// Create list in Aloware
	const alowareListName = `DF_${agentKey}_${listKey}`;
	const description = `Synced call list for ${agentKey} - ${listKey}`;

	try {
		const alowareList = await createCallList({
			name: alowareListName,
			description,
			contact_ids: [],
		});

		const alowareListId = alowareList.id;

		// Store in registry
		await db
			.insert(callListRegistry)
			.values({
				agentKey,
				listKey,
				alowareListId,
				alowareListName,
			})
			.onConflictDoUpdate({
				target: [callListRegistry.agentKey, callListRegistry.listKey],
				set: {
					alowareListId,
					alowareListName,
					updatedAt: new Date(),
				},
			});

		return alowareListId;
	} catch (error) {
		console.error(`[ensureCallList] Error creating list ${alowareListName}:`, error);
		throw error;
	}
}

