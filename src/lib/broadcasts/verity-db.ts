/**
 * Verity Database Connection
 * 
 * Provides a connection pool to Verity's database for querying broadcast data
 */

import postgres from "postgres";
import { env } from "@/env";

let verityDb: postgres.Sql | null = null;

/**
 * Get or create Verity database connection
 */
export function getVerityDb(): postgres.Sql {
	if (verityDb) {
		return verityDb;
	}

	const verityDbUrl = env.VERITY_DATABASE_URL;
	if (!verityDbUrl) {
		throw new Error("VERITY_DATABASE_URL is not configured");
	}

	verityDb = postgres(verityDbUrl, {
		max: 5, // Connection pool size
		idle_timeout: 20,
		connect_timeout: 10,
	});

	return verityDb;
}

/**
 * Close Verity database connection
 */
export async function closeVerityDb(): Promise<void> {
	if (verityDb) {
		await verityDb.end();
		verityDb = null;
	}
}


