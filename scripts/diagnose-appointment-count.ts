#!/usr/bin/env bun
/**
 * Diagnose Appointment Count Issues
 * 
 * Investigates why broadcast appointment counts might be low.
 * Checks multiple potential issues with appointment tracking.
 */

import { config } from "dotenv";
import postgres from "postgres";

// Load environment variables
config({ path: ".env.local" });

const VERITY_DB_URL = process.env.VERITY_DATABASE_URL;
if (!VERITY_DB_URL) {
	throw new Error("VERITY_DATABASE_URL is not configured");
}

function getVerityDb() {
	return postgres(VERITY_DB_URL, {
		max: 5,
		idle_timeout: 20,
		connect_timeout: 10,
	});
}

interface DiagnosticResult {
	check: string;
	status: "pass" | "warning" | "error";
	message: string;
	data?: Record<string, unknown>;
}

/**
 * Diagnose appointment counting issues for a broadcast
 */
async function diagnoseAppointmentCount(broadcastId: string) {
	const db = getVerityDb();
	const results: DiagnosticResult[] = [];

	console.log(`\n=== Diagnosing Appointment Count for Broadcast ${broadcastId} ===\n`);

	// 1. Get broadcast info
	const broadcast = await db`
		SELECT id, user_id, type, subject, executed_at, completed_at
		FROM broadcast
		WHERE id = ${broadcastId}
	`.then(rows => rows[0]);

	if (!broadcast) {
		console.error(`Broadcast ${broadcastId} not found`);
		return;
	}

	const broadcastType = broadcast.type as "sms" | "email";
	const broadcastStartTime = broadcast.executed_at instanceof Date
		? broadcast.executed_at
		: broadcast.executed_at
			? new Date(broadcast.executed_at)
			: new Date(0);

	console.log(`Broadcast: ${broadcast.subject || broadcastId}`);
	console.log(`Type: ${broadcastType}`);
	console.log(`Executed At: ${broadcastStartTime.toISOString()}\n`);

	// 2. Get delivered recipients
	const deliveredRecipients = broadcastType === "sms"
		? await db`
			SELECT DISTINCT contact_id
			FROM broadcast_recipient
			WHERE broadcast_id = ${broadcastId}
			AND status = 'sent'
		`
		: await db`
			SELECT DISTINCT contact_id
			FROM broadcast_recipient
			WHERE broadcast_id = ${broadcastId}
			AND status IN ('delivered', 'opened', 'clicked')
		`;

	const deliveredContactIds = deliveredRecipients.map(r => r.contact_id);
	console.log(`Delivered Recipients: ${deliveredContactIds.length}\n`);

	if (deliveredContactIds.length === 0) {
		results.push({
			check: "delivered_recipients",
			status: "error",
			message: "No delivered recipients found",
		});
		return results;
	}

	// 3. Check appointments in leads table (current method)
	// First verify we can query the table
	let appointmentsInLeads = 0;
	if (deliveredContactIds.length > 0) {
		try {
			// Test query first
			const testQuery = await db`SELECT COUNT(*)::int as count FROM leads LIMIT 1`;
			console.log(`[debug] Leads table accessible, total rows: ${testQuery[0]?.count || 0}`);
			
			// Use a VALUES clause instead of ANY to avoid parameter binding issues
			const valuesClause = deliveredContactIds.map(id => `('${id}')`).join(', ');
			appointmentsInLeads = await db.unsafe(`
				SELECT COUNT(*)::int as count
				FROM leads l
				INNER JOIN (VALUES ${valuesClause}) AS v(contact_id) ON l.contact_id = v.contact_id::uuid
				WHERE l.ghl_appointment_id IS NOT NULL
				AND COALESCE(l.last_activity_at, l.created_at) >= $1::timestamp
			`, [broadcastStartTime]).then(rows => (rows[0] as any)?.count || 0);
		} catch (error: any) {
			console.error(`[debug] Error querying leads table:`, error.message);
			console.error(`[debug] Query: SELECT COUNT(*) FROM leads WHERE contact_id = ANY(...)`);
			throw error;
		}
	}

	results.push({
		check: "appointments_in_leads",
		status: appointmentsInLeads > 0 ? "pass" : "warning",
		message: `Found ${appointmentsInLeads} appointments in leads table (current counting method)`,
		data: { count: appointmentsInLeads },
	});

	// 4. Check appointments WITHOUT ghl_appointment_id requirement
	const appointmentsWithoutGhlId = deliveredContactIds.length > 0 ? await db`
		SELECT COUNT(*)::int as count
		FROM leads
		WHERE contact_id = ANY(${deliveredContactIds}::uuid[])
		AND COALESCE(last_activity_at, created_at) >= ${broadcastStartTime}
	`.then(rows => rows[0]?.count || 0) : 0;

	if (appointmentsWithoutGhlId > appointmentsInLeads) {
		results.push({
			check: "appointments_missing_ghl_id",
			status: "error",
			message: `Found ${appointmentsWithoutGhlId} total appointments, but only ${appointmentsInLeads} have ghl_appointment_id. Missing ${appointmentsWithoutGhlId - appointmentsInLeads} appointments!`,
			data: {
				total: appointmentsWithoutGhlId,
				withGhlId: appointmentsInLeads,
				missing: appointmentsWithoutGhlId - appointmentsInLeads,
			},
		});
	}

	// 5. Check appointments WITHOUT time window filter
	const appointmentsWithoutTimeFilter = deliveredContactIds.length > 0 ? await db`
		SELECT COUNT(*)::int as count
		FROM leads
		WHERE contact_id = ANY(${deliveredContactIds}::uuid[])
		AND ghl_appointment_id IS NOT NULL
	`.then(rows => rows[0]?.count || 0) : 0;

	if (appointmentsWithoutTimeFilter > appointmentsInLeads) {
		results.push({
			check: "appointments_excluded_by_time",
			status: "warning",
			message: `Found ${appointmentsWithoutTimeFilter} appointments total, but only ${appointmentsInLeads} after time filter. Time window may be excluding ${appointmentsWithoutTimeFilter - appointmentsInLeads} appointments.`,
			data: {
				total: appointmentsWithoutTimeFilter,
				afterTimeFilter: appointmentsInLeads,
				excluded: appointmentsWithoutTimeFilter - appointmentsInLeads,
				broadcastStartTime: broadcastStartTime.toISOString(),
			},
		});
	}

	// 6. Check if appointments exist in other tables
	// Check for appointments table (if it exists)
	try {
		const appointmentsInAppointmentsTable = deliveredContactIds.length > 0 ? await db`
			SELECT COUNT(*)::int as count
			FROM appointments
			WHERE contact_id = ANY(${deliveredContactIds}::uuid[])
			AND created_at >= ${broadcastStartTime}
		`.then(rows => rows[0]?.count || 0) : 0;

		if (appointmentsInAppointmentsTable > 0) {
			results.push({
				check: "appointments_in_appointments_table",
				status: "error",
				message: `Found ${appointmentsInAppointmentsTable} appointments in 'appointments' table that aren't being counted!`,
				data: { count: appointmentsInAppointmentsTable },
			});
		}
	} catch (error) {
		// Table doesn't exist, skip
	}

	// 7. Check contact_id matching issues
	// Get sample of delivered contacts
	const sampleContacts = await db`
		SELECT DISTINCT contact_id, phone_e164, email
		FROM contacts
		WHERE id = ANY(${deliveredContactIds.slice(0, 10)})
	`.then(rows => rows);

	const contactsWithAppointments = deliveredContactIds.length > 0 ? await db`
		SELECT DISTINCT l.contact_id, COUNT(*)::int as appointment_count
		FROM leads l
		WHERE l.contact_id = ANY(${deliveredContactIds}::uuid[])
		AND l.ghl_appointment_id IS NOT NULL
		GROUP BY l.contact_id
		LIMIT 10
	`.then(rows => rows) : [];

	results.push({
		check: "contact_matching",
		status: "pass",
		message: `Sample: ${sampleContacts.length} contacts checked, ${contactsWithAppointments.length} have appointments`,
		data: {
			sampleContacts: sampleContacts.length,
			contactsWithAppointments: contactsWithAppointments.length,
		},
	});

	// 8. Check for appointments created BEFORE broadcast but might be related
	const appointmentsBeforeBroadcast = deliveredContactIds.length > 0 ? await db`
		SELECT COUNT(*)::int as count
		FROM leads
		WHERE contact_id = ANY(${deliveredContactIds}::uuid[])
		AND ghl_appointment_id IS NOT NULL
		AND COALESCE(last_activity_at, created_at) < ${broadcastStartTime}
	`.then(rows => rows[0]?.count || 0) : 0;

	if (appointmentsBeforeBroadcast > 0) {
		results.push({
			check: "appointments_before_broadcast",
			status: "warning",
			message: `Found ${appointmentsBeforeBroadcast} appointments created BEFORE broadcast start time. These are excluded by design.`,
			data: { count: appointmentsBeforeBroadcast },
		});
	}

	// 9. Summary: Total potential appointments
	const totalPotentialAppointments = deliveredContactIds.length > 0 ? await db`
		SELECT COUNT(*)::int as count
		FROM leads
		WHERE contact_id = ANY(${deliveredContactIds}::uuid[])
		AND ghl_appointment_id IS NOT NULL
	`.then(rows => rows[0]?.count || 0) : 0;

	results.push({
		check: "summary",
		status: totalPotentialAppointments === appointmentsInLeads ? "pass" : "warning",
		message: `Total appointments found: ${totalPotentialAppointments}, Counted by current logic: ${appointmentsInLeads}`,
		data: {
			total: totalPotentialAppointments,
			counted: appointmentsInLeads,
			missing: totalPotentialAppointments - appointmentsInLeads,
		},
	});

	return results;
}

/**
 * Format diagnostic results
 */
function formatDiagnosticReport(results: DiagnosticResult[]): string {
	let report = "\n=== APPOINTMENT COUNT DIAGNOSTIC REPORT ===\n\n";

	const errors = results.filter((r) => r.status === "error");
	const warnings = results.filter((r) => r.status === "warning");
	const passes = results.filter((r) => r.status === "pass");

	report += `Summary:\n`;
	report += `  ✅ Passed: ${passes.length}\n`;
	report += `  ⚠️  Warnings: ${warnings.length}\n`;
	report += `  ❌ Errors: ${errors.length}\n\n`;

	if (errors.length > 0) {
		report += `\n❌ CRITICAL ISSUES:\n`;
		report += "─".repeat(60) + "\n";
		errors.forEach((result) => {
			report += `\n[${result.check.toUpperCase()}]\n`;
			report += `  ${result.message}\n`;
			if (result.data) {
				Object.entries(result.data).forEach(([key, value]) => {
					report += `  ${key}: ${value}\n`;
				});
			}
		});
	}

	if (warnings.length > 0) {
		report += `\n⚠️  WARNINGS:\n`;
		report += "─".repeat(60) + "\n";
		warnings.forEach((result) => {
			report += `\n[${result.check.toUpperCase()}]\n`;
			report += `  ${result.message}\n`;
			if (result.data) {
				Object.entries(result.data).forEach(([key, value]) => {
					report += `  ${key}: ${value}\n`;
				});
			}
		});
	}

	report += "\n" + "=".repeat(60) + "\n";

	return report;
}

// Main execution
if (import.meta.main) {
	const broadcastId = process.argv[2];

	if (!broadcastId) {
		console.error("Usage: bun run scripts/diagnose-appointment-count.ts <broadcastId>");
		console.error("\nExample:");
		console.error("  bun run scripts/diagnose-appointment-count.ts abc123def456");
		process.exit(1);
	}

	diagnoseAppointmentCount(broadcastId)
		.then((results) => {
			if (results) {
				const report = formatDiagnosticReport(results);
				console.log(report);
			}
		})
		.catch((error) => {
			console.error("Error:", error);
			process.exit(1);
		});
}

export { diagnoseAppointmentCount, formatDiagnosticReport, type DiagnosticResult };
