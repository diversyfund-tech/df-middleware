import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("ERROR: DATABASE_URL environment variable is required");
	console.error("Make sure .env.local exists and contains DATABASE_URL");
	process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function runMigration() {
	const migrationPath = join(
		process.cwd(),
		"drizzle/0005_add_workflow_definitions.sql",
	);
	const migrationSQL = readFileSync(migrationPath, "utf-8");

	// Split SQL into individual statements
	const statements: string[] = [];
	const lines = migrationSQL.split("\n");
	let currentStatement = "";
	
	for (const line of lines) {
		const trimmed = line.trim();
		// Skip comments
		if (trimmed.startsWith("--") || trimmed.length === 0) {
			continue;
		}
		
		currentStatement += line + "\n";
		
		// If line ends with semicolon, complete the statement
		if (trimmed.endsWith(";")) {
			statements.push(currentStatement.trim());
			currentStatement = "";
		}
	}
	
	// Add any remaining statement
	if (currentStatement.trim().length > 0) {
		statements.push(currentStatement.trim());
	}
	
	// Filter out empty statements
	const filteredStatements = statements.filter((s) => s.length > 0);

	console.log("\n=== Running Workflow Definitions Migration ===\n");
	console.log(`Found ${filteredStatements.length} statements to execute\n`);

	let successCount = 0;
	let skippedCount = 0;
	let errorCount = 0;

	for (let i = 0; i < filteredStatements.length; i++) {
		const statement = filteredStatements[i];
		try {
			// Use unsafe() for raw SQL statements
			await sql.unsafe(statement);
			console.log(`[OK] Statement ${i + 1} executed successfully`);
			successCount++;
		} catch (error: unknown) {
			const err = error as { code?: string; message?: string };
			if (
				err.code === "42P07" ||
				err.code === "42710" ||
				err.message?.includes("already exists") ||
				err.message?.includes("duplicate")
			) {
				console.log(`[SKIP] Statement ${i + 1} skipped (already exists)`);
				skippedCount++;
			} else {
				console.error(`[ERROR] Statement ${i + 1} failed:`, err.message);
				console.error(`Statement preview:`, statement.substring(0, 200));
				errorCount++;
			}
		}
	}

	console.log("\n=== Migration Complete ===");
	console.log(`[OK] Successful: ${successCount}`);
	console.log(`[SKIP] Skipped: ${skippedCount}`);
	console.log(`[ERROR] Errors: ${errorCount}\n`);

	if (errorCount > 0) {
		process.exit(1);
	}
}

runMigration()
	.then(() => {
		console.log("Migration completed successfully");
		process.exit(0);
	})
	.catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	})
	.finally(() => {
		sql.end();
	});
