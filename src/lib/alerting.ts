/**
 * Alerting system for monitoring and notifications
 * 
 * Monitors:
 * - High error rates
 * - Job queue backups
 * - External API failures
 * - Database connection failures
 */

import { env } from "@/env";
import { db } from "@/server/db";
import { webhookEvents, syncLog } from "@/server/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "./logger";

interface Alert {
	level: "critical" | "warning";
	title: string;
	message: string;
	timestamp: Date;
	metadata?: Record<string, unknown>;
}

/**
 * Send alert via webhook
 */
async function sendAlert(alert: Alert): Promise<void> {
	const webhookUrl = env.ALERT_WEBHOOK_URL;
	if (!webhookUrl) {
		logger.warn({ alert }, "Alert triggered but ALERT_WEBHOOK_URL not configured");
		return;
	}

	try {
		await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				level: alert.level,
				title: alert.title,
				message: alert.message,
				timestamp: alert.timestamp.toISOString(),
				metadata: alert.metadata,
			}),
		});
		logger.info({ alert }, "Alert sent successfully");
	} catch (error) {
		logger.error({ alert, error }, "Failed to send alert");
	}
}

/**
 * Check for high error rate
 * Critical if error rate > 5% for 5 minutes
 * Warning if error rate > 1% for 5 minutes
 */
export async function checkErrorRate(): Promise<void> {
	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

	try {
		// Check webhook event error rate
		const totalWebhooks = await db
			.select({ count: sql<number>`count(*)` })
			.from(webhookEvents)
			.where(gte(webhookEvents.receivedAt, fiveMinutesAgo));

		const errorWebhooks = await db
			.select({ count: sql<number>`count(*)` })
			.from(webhookEvents)
			.where(
				and(
					gte(webhookEvents.receivedAt, fiveMinutesAgo),
					eq(webhookEvents.status, "error")
				)
			);

		const total = totalWebhooks[0]?.count || 0;
		const errors = errorWebhooks[0]?.count || 0;
		const errorRate = total > 0 ? (errors / total) * 100 : 0;

		if (errorRate > 5) {
			await sendAlert({
				level: "critical",
				title: "High Error Rate Detected",
				message: `Webhook error rate is ${errorRate.toFixed(2)}% (${errors}/${total} errors) in the last 5 minutes`,
				timestamp: new Date(),
				metadata: {
					errorRate,
					total,
					errors,
					timeWindow: "5 minutes",
				},
			});
		} else if (errorRate > 1) {
			await sendAlert({
				level: "warning",
				title: "Elevated Error Rate",
				message: `Webhook error rate is ${errorRate.toFixed(2)}% (${errors}/${total} errors) in the last 5 minutes`,
				timestamp: new Date(),
				metadata: {
					errorRate,
					total,
					errors,
					timeWindow: "5 minutes",
				},
			});
		}

		// Check sync operation error rate
		const totalSyncs = await db
			.select({ count: sql<number>`count(*)` })
			.from(syncLog)
			.where(gte(syncLog.startedAt, fiveMinutesAgo));

		const errorSyncs = await db
			.select({ count: sql<number>`count(*)` })
			.from(syncLog)
			.where(
				and(
					gte(syncLog.startedAt, fiveMinutesAgo),
					eq(syncLog.status, "error")
				)
			);

		const syncTotal = totalSyncs[0]?.count || 0;
		const syncErrors = errorSyncs[0]?.count || 0;
		const syncErrorRate = syncTotal > 0 ? (syncErrors / syncTotal) * 100 : 0;

		if (syncErrorRate > 5) {
			await sendAlert({
				level: "critical",
				title: "High Sync Error Rate",
				message: `Sync operation error rate is ${syncErrorRate.toFixed(2)}% (${syncErrors}/${syncTotal} errors) in the last 5 minutes`,
				timestamp: new Date(),
				metadata: {
					errorRate: syncErrorRate,
					total: syncTotal,
					errors: syncErrors,
					timeWindow: "5 minutes",
				},
			});
		}
	} catch (error) {
		logger.error({ error }, "Error checking error rate");
	}
}

/**
 * Check for job queue backup
 * Critical if queue depth > 1000
 * Warning if queue depth > 500
 */
export async function checkJobQueueBackup(): Promise<void> {
	try {
		// Check webhook events queue
		const pendingWebhooks = await db
			.select({ count: sql<number>`count(*)` })
			.from(webhookEvents)
			.where(eq(webhookEvents.status, "pending"));

		const pendingCount = pendingWebhooks[0]?.count || 0;

		if (pendingCount > 1000) {
			await sendAlert({
				level: "critical",
				title: "Job Queue Backup - Critical",
				message: `Job queue has ${pendingCount} pending webhook events. Queue depth exceeds critical threshold.`,
				timestamp: new Date(),
				metadata: {
					queueDepth: pendingCount,
					threshold: 1000,
				},
			});
		} else if (pendingCount > 500) {
			await sendAlert({
				level: "warning",
				title: "Job Queue Backup - Warning",
				message: `Job queue has ${pendingCount} pending webhook events. Queue depth is elevated.`,
				timestamp: new Date(),
				metadata: {
					queueDepth: pendingCount,
					threshold: 500,
				},
			});
		}
	} catch (error) {
		logger.error({ error }, "Error checking job queue backup");
	}
}

/**
 * Check for external API failures
 * Critical if failure rate > 10% for 5 minutes
 */
export async function checkExternalApiFailures(): Promise<void> {
	// This would integrate with metrics to check external API error rates
	// For now, we check sync logs for API-related errors
	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

	try {
		const apiErrors = await db
			.select({ count: sql<number>`count(*)` })
			.from(syncLog)
			.where(
				and(
					gte(syncLog.startedAt, fiveMinutesAgo),
					eq(syncLog.status, "error"),
					sql`${syncLog.errorMessage} LIKE '%API%' OR ${syncLog.errorMessage} LIKE '%api%'`
				)
			);

		const errorCount = apiErrors[0]?.count || 0;

		if (errorCount > 10) {
			await sendAlert({
				level: "critical",
				title: "External API Failures",
				message: `${errorCount} external API errors detected in the last 5 minutes`,
				timestamp: new Date(),
				metadata: {
					errorCount,
					timeWindow: "5 minutes",
				},
			});
		}
	} catch (error) {
		logger.error({ error }, "Error checking external API failures");
	}
}

/**
 * Run all alert checks
 */
export async function runAlertChecks(): Promise<void> {
	try {
		await Promise.all([
			checkErrorRate(),
			checkJobQueueBackup(),
			checkExternalApiFailures(),
		]);
	} catch (error) {
		logger.error({ error }, "Error running alert checks");
	}
}
