/**
 * Get Broadcast Name from Verity Database
 * 
 * Queries Verity's database to get the broadcast subject/name.
 */

import { getVerityDb } from "./verity-db";

/**
 * Get broadcast name (subject) from Verity database
 */
export async function getBroadcastName(broadcastId: string): Promise<string> {
	const db = getVerityDb();

	const broadcast = await db`
		SELECT subject, type
		FROM broadcast
		WHERE id = ${broadcastId}
	`.then(rows => rows[0]);

	if (!broadcast) {
		throw new Error(`Broadcast not found: ${broadcastId}`);
	}

	// Return subject if available, otherwise generate a name
	return broadcast.subject || `${(broadcast.type as string).toUpperCase()} Broadcast ${broadcastId.substring(0, 8)}`;
}


