/**
 * Diagnostic script to check appointment webhook events and sync status
 * 
 * This script helps diagnose why appointments might not be syncing properly
 * between GHL and Verity.
 */

import { db } from "../src/server/db";
import { webhookEvents } from "../src/server/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { getVerityDb } from "../src/lib/broadcasts/verity-db";

interface DiagnosticResult {
	check: string;
	status: "pass" | "warning" | "error";
	message: string;
	data?: Record<string, unknown>;
}

async function diagnoseAppointmentSync() {
	const results: DiagnosticResult[] = [];
	const verityDb = getVerityDb();

	// 1. Check recent appointment webhook events (last 24 hours)
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const recentAppointmentEvents = await db
		.select()
		.from(webhookEvents)
		.where(
			and(
				eq(webhookEvents.entityType, "appointment"),
				eq(webhookEvents.source, "ghl"),
				gte(webhookEvents.receivedAt, oneDayAgo)
			)
		)
		.orderBy(desc(webhookEvents.receivedAt))
		.limit(50);

	results.push({
		check: "recent_appointment_events",
		status: recentAppointmentEvents.length > 0 ? "pass" : "warning",
		message: `Found ${recentAppointmentEvents.length} appointment webhook events in the last 24 hours`,
		data: { count: recentAppointmentEvents.length },
	});

	// 2. Check event processing status
	const pendingEvents = recentAppointmentEvents.filter(e => e.status === "pending");
	const processingEvents = recentAppointmentEvents.filter(e => e.status === "processing");
	const doneEvents = recentAppointmentEvents.filter(e => e.status === "done");
	const errorEvents = recentAppointmentEvents.filter(e => e.status === "error");

	results.push({
		check: "event_processing_status",
		status: errorEvents.length > 0 ? "error" : pendingEvents.length > 10 ? "warning" : "pass",
		message: `Events: ${doneEvents.length} done, ${pendingEvents.length} pending, ${processingEvents.length} processing, ${errorEvents.length} errors`,
		data: {
			done: doneEvents.length,
			pending: pendingEvents.length,
			processing: processingEvents.length,
			errors: errorEvents.length,
		},
	});

	// 3. Analyze payloads for contactId extraction issues
	let missingContactId = 0;
	let hasContactId = 0;
	const payloadAnalysis: Array<{
		eventId: string;
		appointmentId: string | null;
		contactId: string | null;
		hasPhone: boolean;
		hasEmail: boolean;
		payloadStructure: string;
	}> = [];

	for (const event of recentAppointmentEvents) {
		const payload = event.payloadJson as any;
		const appointmentId = event.entityId || payload.id || payload.appointmentId || payload.appointment?.id;
		const contactId = payload.contactId || 
		                  payload.contact_id || 
		                  payload.contact?.id || 
		                  payload.contact?.contactId ||
		                  payload.appointment?.contactId ||
		                  payload.body?.contactId ||
		                  payload.data?.contactId;
		const phone = payload.phone || payload.contact?.phone || payload.contact?.phoneNumber;
		const email = payload.email || payload.contact?.email;

		if (!contactId) {
			missingContactId++;
		} else {
			hasContactId++;
		}

		payloadAnalysis.push({
			eventId: event.id,
			appointmentId: appointmentId ? String(appointmentId) : null,
			contactId: contactId ? String(contactId) : null,
			hasPhone: !!phone,
			hasEmail: !!email,
			payloadStructure: Object.keys(payload).slice(0, 10).join(", "),
		});
	}

	results.push({
		check: "contactid_extraction",
		status: missingContactId > 0 ? "warning" : "pass",
		message: `${hasContactId} events have contactId, ${missingContactId} are missing contactId`,
		data: {
			hasContactId,
			missingContactId,
			eventsWithPhone: payloadAnalysis.filter(p => p.hasPhone).length,
			eventsWithEmail: payloadAnalysis.filter(p => p.hasEmail).length,
		},
	});

	// 4. Check if appointments are synced to Verity leads table
	if (recentAppointmentEvents.length > 0) {
		const appointmentIds = recentAppointmentEvents
			.map(e => {
				const payload = e.payloadJson as any;
				return e.entityId || payload.id || payload.appointmentId || payload.appointment?.id;
			})
			.filter((id): id is string => !!id)
			.map(String);

		if (appointmentIds.length > 0) {
			const syncedAppointments = await verityDb`
				SELECT COUNT(*)::int as count
				FROM leads
				WHERE ghl_appointment_id = ANY(${appointmentIds})
			`.then(rows => rows[0]?.count || 0);

			results.push({
				check: "verity_sync_status",
				status: syncedAppointments < appointmentIds.length ? "warning" : "pass",
				message: `${syncedAppointments} of ${appointmentIds.length} appointments found in Verity leads table`,
				data: {
					synced: syncedAppointments,
					total: appointmentIds.length,
					missing: appointmentIds.length - syncedAppointments,
				},
			});
		}
	}

	// 5. Check error events for patterns
	if (errorEvents.length > 0) {
		const errorMessages = errorEvents
			.map(e => e.errorMessage)
			.filter((msg): msg is string => !!msg);
		
		const errorPatterns: Record<string, number> = {};
		for (const msg of errorMessages) {
			const pattern = msg.includes("contact") ? "contact_related" :
			                msg.includes("appointment") ? "appointment_related" :
			                msg.includes("sync") ? "sync_related" :
			                "other";
			errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
		}

		results.push({
			check: "error_patterns",
			status: "error",
			message: `Found ${errorEvents.length} error events with patterns: ${JSON.stringify(errorPatterns)}`,
			data: {
				errorCount: errorEvents.length,
				patterns: errorPatterns,
				sampleErrors: errorMessages.slice(0, 5),
			},
		});
	}

	// 6. Sample payload structures for debugging
	if (payloadAnalysis.length > 0) {
		const samplesWithContactId = payloadAnalysis.filter(p => p.contactId).slice(0, 3);
		const samplesWithoutContactId = payloadAnalysis.filter(p => !p.contactId).slice(0, 3);

		results.push({
			check: "payload_samples",
			status: "pass",
			message: "Sample payload structures",
			data: {
				withContactId: samplesWithContactId,
				withoutContactId: samplesWithoutContactId,
			},
		});
	}

	return results;
}

/**
 * Format diagnostic results
 */
function formatDiagnosticReport(results: DiagnosticResult[]): string {
	let report = "\n=== APPOINTMENT SYNC DIAGNOSTIC REPORT ===\n\n";

	for (const result of results) {
		const icon = result.status === "pass" ? "✓" : result.status === "warning" ? "⚠" : "✗";
		report += `${icon} ${result.check}: ${result.message}\n`;
		if (result.data) {
			report += `   Data: ${JSON.stringify(result.data, null, 2)}\n`;
		}
		report += "\n";
	}

	return report;
}

// Run diagnostics
if (require.main === module) {
	diagnoseAppointmentSync()
		.then(results => {
			console.log(formatDiagnosticReport(results));
			process.exit(0);
		})
		.catch(error => {
			console.error("Error running diagnostics:", error);
			process.exit(1);
		});
}

export { diagnoseAppointmentSync };
