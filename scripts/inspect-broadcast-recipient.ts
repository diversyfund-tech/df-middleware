#!/usr/bin/env bun
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const VERITY_DB_URL = process.env.VERITY_DATABASE_URL;
if (!VERITY_DB_URL) {
	throw new Error("VERITY_DATABASE_URL is not configured");
}

const db = postgres(VERITY_DB_URL);

async function inspect() {
	try {
		const columns = await db`
			SELECT column_name, data_type
			FROM information_schema.columns
			WHERE table_name = 'broadcast_recipient'
			ORDER BY ordinal_position
		`;

		console.log("\n=== broadcast_recipient Columns ===\n");
		columns.forEach((col: any) => {
			console.log(`${col.column_name} (${col.data_type})`);
		});

		const sample = await db`
			SELECT * FROM broadcast_recipient LIMIT 1
		`;

		if (sample.length > 0) {
			console.log("\n=== Sample Row ===\n");
			console.log(JSON.stringify(sample[0], null, 2));
		}
	} catch (error) {
		console.error("Error:", error);
	} finally {
		await db.end();
	}
}

inspect();
