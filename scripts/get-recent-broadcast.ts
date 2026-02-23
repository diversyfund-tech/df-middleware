#!/usr/bin/env bun
/**
 * Get Recent Broadcast ID
 * 
 * Lists recent broadcasts from Verity database
 */

import { config } from "dotenv";
import postgres from "postgres";

// Load environment variables
config({ path: ".env.local" });

const VERITY_DB_URL = process.env.VERITY_DATABASE_URL;
if (!VERITY_DB_URL) {
	throw new Error("VERITY_DATABASE_URL is not configured");
}

function getVerityDb() {
	return postgres(VERITY_DB_URL, {
		max: 5,
		idle_timeout: 20,
		connect_timeout: 10,
	});
}

async function getRecentBroadcasts(limit = 5) {
	const db = getVerityDb();

	const broadcasts = await db`
		SELECT id, subject, type, executed_at, completed_at
		FROM broadcast
		ORDER BY executed_at DESC NULLS LAST, created_at DESC
		LIMIT ${limit}
	`;

	return broadcasts;
}

if (import.meta.main) {
	getRecentBroadcasts(10)
		.then((broadcasts) => {
			console.log("\n=== Recent Broadcasts ===\n");
			if (broadcasts.length === 0) {
				console.log("No broadcasts found.");
			} else {
				broadcasts.forEach((b, i) => {
					console.log(`${i + 1}. ${b.subject || `[${b.type}] Broadcast`}`);
					console.log(`   ID: ${b.id}`);
					console.log(`   Executed: ${b.executed_at ? new Date(b.executed_at).toISOString() : "N/A"}`);
					console.log("");
				});
				console.log(`\nTo run diagnostic, use:`);
				console.log(`  bun run scripts/diagnose-appointment-count.ts ${broadcasts[0]?.id}`);
			}
		})
		.catch((error) => {
			console.error("Error:", error);
			process.exit(1);
		});
}

export { getRecentBroadcasts };
