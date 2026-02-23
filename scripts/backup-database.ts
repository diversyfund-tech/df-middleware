#!/usr/bin/env bun
/**
 * Database Backup Script
 * 
 * Creates a backup of the PostgreSQL database using pg_dump
 * 
 * Usage:
 *   bun run scripts/backup-database.ts
 * 
 * Environment Variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   BACKUP_DIR - Directory to store backups (default: ./backups)
 *   BACKUP_RETENTION_DAYS - Number of days to keep backups (default: 30)
 */

import { execSync } from "child_process";
import { mkdir, readdir, unlink, stat } from "fs/promises";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || "30", 10);

if (!DATABASE_URL) {
	console.error("ERROR: DATABASE_URL environment variable is not set");
	process.exit(1);
}

/**
 * Parse PostgreSQL connection string to extract connection details
 */
function parseDatabaseUrl(url: string): {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
} {
	const urlObj = new URL(url);
	return {
		host: urlObj.hostname,
		port: parseInt(urlObj.port || "5432", 10),
		database: urlObj.pathname.slice(1), // Remove leading /
		user: urlObj.username,
		password: urlObj.password,
	};
}

/**
 * Create database backup using pg_dump
 */
async function createBackup(): Promise<string> {
	const dbConfig = parseDatabaseUrl(DATABASE_URL!);
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupFileName = `backup-${timestamp}.sql`;
	const backupPath = join(BACKUP_DIR, backupFileName);

	// Ensure backup directory exists
	await mkdir(BACKUP_DIR, { recursive: true });

	console.log(`[backup] Creating backup: ${backupPath}`);

	// Set PGPASSWORD environment variable for pg_dump
	const env = {
		...process.env,
		PGPASSWORD: dbConfig.password,
	};

	// Run pg_dump
	const pgDumpCommand = [
		"pg_dump",
		`--host=${dbConfig.host}`,
		`--port=${dbConfig.port}`,
		`--username=${dbConfig.user}`,
		`--dbname=${dbConfig.database}`,
		"--format=plain",
		"--no-owner",
		"--no-acl",
		`--file=${backupPath}`,
	].join(" ");

	try {
		execSync(pgDumpCommand, {
			env,
			stdio: "inherit",
		});
		console.log(`[backup] Backup created successfully: ${backupPath}`);
		return backupPath;
	} catch (error) {
		console.error(`[backup] Error creating backup:`, error);
		throw error;
	}
}

/**
 * Clean up old backups based on retention policy
 */
async function cleanupOldBackups(): Promise<void> {
	try {
		const files = await readdir(BACKUP_DIR);
		const now = Date.now();
		const retentionMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

		for (const file of files) {
			if (!file.startsWith("backup-") || !file.endsWith(".sql")) {
				continue;
			}

			const filePath = join(BACKUP_DIR, file);
			const stats = await stat(filePath);
			const age = now - stats.mtimeMs;

			if (age > retentionMs) {
				await unlink(filePath);
				console.log(`[backup] Deleted old backup: ${file}`);
			}
		}
	} catch (error) {
		console.error(`[backup] Error cleaning up old backups:`, error);
		// Don't throw - cleanup errors shouldn't fail the backup
	}
}

/**
 * Main backup function
 */
async function main() {
	try {
		console.log("[backup] Starting database backup...");
		await createBackup();
		await cleanupOldBackups();
		console.log("[backup] Backup completed successfully");
	} catch (error) {
		console.error("[backup] Backup failed:", error);
		process.exit(1);
	}
}

// Run if executed directly
if (import.meta.main) {
	main();
}
