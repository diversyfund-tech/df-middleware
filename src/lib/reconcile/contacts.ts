import { db } from "@/server/db";
import { contactMappings, reconcileRuns } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getContact } from "@/lib/ghl/client";
import { syncGHLContactToAloware } from "@/lib/sync/ghl-contact-sync";
import { randomUUID } from "crypto";

/**
 * Reconcile contacts between GHL and Aloware
 * Ensures mappings exist and merged state matches both systems
 */
export async function reconcileContacts(): Promise<{
	driftCount: number;
	repairsCount: number;
	errors: number;
}> {
	const jobName = "reconcile-contacts";
	const runId = randomUUID();

	// Create reconcile run record
	const run = await db.insert(reconcileRuns).values({
		id: runId,
		jobName,
		status: "running",
		totals: {},
	}).returning();

	let driftCount = 0;
	let repairsCount = 0;
	let errors = 0;

	try {
		// Get all contact mappings
		const mappings = await db.query.contactMappings.findMany();

		console.log(`[reconcile] Processing ${mappings.length} contact mappings`);

		for (const mapping of mappings) {
			try {
				// Check if GHL contact still exists
				try {
					await getContact(mapping.ghlContactId);
				} catch (error) {
					// GHL contact doesn't exist - drift detected
					driftCount++;
					console.warn(`[reconcile] GHL contact ${mapping.ghlContactId} not found`);
					continue;
				}

				// Sync to ensure Aloware is up to date
				await syncGHLContactToAloware(mapping.ghlContactId, {
					correlationId: `reconcile-${runId}`,
				});
				repairsCount++;
			} catch (error) {
				errors++;
				console.error(`[reconcile] Error reconciling contact ${mapping.ghlContactId}:`, error);
			}
		}

		// Update reconcile run
		await db
			.update(reconcileRuns)
			.set({
				status: "success",
				finishedAt: new Date(),
				totals: {
					driftCount,
					repairsCount,
					errors,
					totalProcessed: mappings.length,
				},
			})
			.where(eq(reconcileRuns.id, runId));

		console.log(`[reconcile] Completed: ${repairsCount} repairs, ${driftCount} drift, ${errors} errors`);

		return { driftCount, repairsCount, errors };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error("[reconcile] Fatal error:", error);

		// Update reconcile run with error
		await db
			.update(reconcileRuns)
			.set({
				status: "error",
				finishedAt: new Date(),
				errorMessage,
				totals: {
					driftCount,
					repairsCount,
					errors,
				},
			})
			.where(eq(reconcileRuns.id, runId));

		throw error;
	}
}

