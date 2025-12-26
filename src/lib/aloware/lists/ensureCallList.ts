import { db } from "@/server/db";
import { callListRegistry } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getCallLists } from "@/lib/aloware/client";

/**
 * Ensure a call list exists in Aloware for the given agent/listKey combination
 * Returns the Aloware list ID
 * 
 * NOTE: Aloware API does not support creating call lists programmatically.
 * Lists must be created manually in Aloware first, then this function will find them by name.
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

	// Find list in Aloware by name (lists must be created manually)
	const alowareListName = `DF_${agentKey}_${listKey}`;

	try {
		// Fetch all call lists from Aloware
		const allLists = await getCallLists();
		
		// Find list by name (case-insensitive)
		const foundList = allLists.find(
			list => list.name?.toLowerCase() === alowareListName.toLowerCase()
		);

		if (!foundList || !foundList.id) {
			throw new Error(
				`Call list "${alowareListName}" not found in Aloware. ` +
				`Please create this list manually in Aloware first. ` +
				`The list name must match exactly: "${alowareListName}"`
			);
		}

		const alowareListId = String(foundList.id);

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
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ensureCallList] Error finding list ${alowareListName}:`, errorMessage);
		throw error;
	}
}

