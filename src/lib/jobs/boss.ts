import PgBoss from "pg-boss";
import { env } from "@/env";

let boss: PgBoss | null = null;

/**
 * Initialize and start pg-boss instance
 */
export async function startBoss(): Promise<PgBoss> {
	if (boss) {
		return boss;
	}

	boss = new PgBoss({
		connectionString: env.DATABASE_URL,
		retryLimit: 10,
		retryDelay: 60 * 1000, // 60 seconds in milliseconds
		retryBackoff: true,
	});

	await boss.start();

	console.log("[boss] PgBoss started successfully");

	return boss;
}

/**
 * Stop pg-boss instance
 */
export async function stopBoss(): Promise<void> {
	if (boss) {
		await boss.stop();
		boss = null;
		console.log("[boss] PgBoss stopped");
	}
}

/**
 * Get the current boss instance (throws if not started)
 */
export function getBoss(): PgBoss {
	if (!boss) {
		throw new Error("PgBoss not started. Call startBoss() first.");
	}
	return boss;
}

/**
 * Job queue name for webhook event processing
 */
export const WEBHOOK_EVENT_QUEUE = "process-webhook-event";

/**
 * Job queue name for broadcast event processing
 */
export const BROADCAST_EVENT_QUEUE = "process-broadcast-event";

