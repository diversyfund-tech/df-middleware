#!/usr/bin/env bun
/**
 * Inspect Leads Table Schema
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const VERITY_DB_URL = process.env.VERITY_DATABASE_URL;
if (!VERITY_DB_URL) {
	throw new Error("VERITY_DATABASE_URL is not configured");
}

const db = postgres(VERITY_DB_URL);

async function inspectLeadsTable() {
	try {
		// Get column information
		const columns = await db`
			SELECT column_name, data_type, is_nullable
			FROM information_schema.columns
			WHERE table_name = 'leads'
			ORDER BY ordinal_position
		`;

		console.log("\n=== Leads Table Columns ===\n");
		columns.forEach((col: any) => {
			console.log(`${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
		});

		// Get a sample row
		const sample = await db`
			SELECT * FROM leads LIMIT 1
		`;

		if (sample.length > 0) {
			console.log("\n=== Sample Row ===\n");
			console.log(JSON.stringify(sample[0], null, 2));
		} else {
			console.log("\nNo rows in leads table");
		}
	} catch (error) {
		console.error("Error:", error);
	} finally {
		await db.end();
	}
}

inspectLeadsTable();
