#!/usr/bin/env tsx

import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const sql = postgres(process.env.DATABASE_URL!);

async function verify() {
	try {
		const result = await sql`
			SELECT table_name 
			FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'broadcast_webhook_events'
		`;
		
		if (result.length > 0) {
			console.log("✅ Table 'broadcast_webhook_events' exists");
			
			const cols = await sql`
				SELECT column_name, data_type 
				FROM information_schema.columns 
				WHERE table_name = 'broadcast_webhook_events' 
				ORDER BY ordinal_position
			`;
			console.log(`✅ Table has ${cols.length} columns`);
			console.log("Columns:", cols.map(c => `${c.column_name} (${c.data_type})`).join(", "));
		} else {
			console.log("❌ Table 'broadcast_webhook_events' does not exist");
		}
	} catch (error) {
		console.error("❌ Error:", error);
	} finally {
		await sql.end();
	}
}

verify();

