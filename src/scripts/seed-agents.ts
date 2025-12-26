#!/usr/bin/env tsx
/**
 * Seed agent directory script
 * Run with: pnpm run seed:agents
 * 
 * Note: This script uses tsx which should resolve @/ paths via tsconfig.json
 */

// @ts-ignore - tsx should resolve this via tsconfig paths
import { seedAgentDirectory } from "../lib/agents/seed";

async function main() {
	console.log("🌱 Starting agent directory seed...");
	
	try {
		const seeded = await seedAgentDirectory();
		console.log(`✅ Successfully seeded ${seeded} new agent(s)`);
		console.log("Agent directory is ready!");
		process.exit(0);
	} catch (error) {
		console.error("❌ Error seeding agent directory:", error);
		process.exit(1);
	}
}

main();

