import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

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
		"drizzle/0004_add_elevenlabs_workflows.sql",
	);
	const migrationSQL = readFileSync(migrationPath, "utf-8");

	// Split SQL into individual statements
	// Handle DO $$ blocks specially since they contain semicolons
	const statements: string[] = [];
	const lines = migrationSQL.split("\n");
	let currentStatement = "";
	let inDoBlock = false;
	let dollarTag = "";
	
	for (const line of lines) {
		const trimmed = line.trim();
		// Skip comments
		if (trimmed.startsWith("--") || trimmed.length === 0) {
			continue;
		}
		
		currentStatement += line + "\n";
		
		// Detect start of DO $$ block
		if (trimmed.startsWith("DO $$")) {
			inDoBlock = true;
			// Extract dollar tag (usually just $$)
			const match = trimmed.match(/DO (\$\$[^\$]*\$\$)/);
			if (match) {
				dollarTag = match[1];
			} else {
				dollarTag = "$$";
			}
		}
		
		// Detect end of DO $$ block
		if (inDoBlock && trimmed.includes(`END ${dollarTag};`)) {
			statements.push(currentStatement.trim());
			currentStatement = "";
			inDoBlock = false;
			dollarTag = "";
			continue;
		}
		
		// If not in DO block and line ends with semicolon, complete the statement
		if (!inDoBlock && trimmed.endsWith(";")) {
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

	console.log("\n=== Running ElevenLabs Workflows Migration ===\n");
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
