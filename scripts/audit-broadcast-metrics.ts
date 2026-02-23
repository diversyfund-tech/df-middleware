#!/usr/bin/env bun
/**
 * Broadcast Metrics Audit Script
 * 
 * Validates broadcast analytics metrics for mathematical consistency,
 * percentage accuracy, and data integrity issues.
 */

interface BroadcastMetrics {
	totalRecipients: number;
	pending: number;
	totalSent: number;
	delivered: number;
	failed: number;
	responses: number;
	appointments: number;
	optedOut: number;
	// Calculated rates (as percentages, e.g., 99.77 for 99.77%)
	deliveryRate?: number;
	responseRate?: number;
	conversionRate?: number;
	failureRate?: number;
	optOutRate?: number;
	appointmentSetRate?: number;
}

interface AuditResult {
	metric: string;
	status: "pass" | "warning" | "error";
	expected?: number;
	actual?: number;
	message: string;
}

/**
 * Audit broadcast metrics
 */
function auditMetrics(metrics: BroadcastMetrics): AuditResult[] {
	const results: AuditResult[] = [];

	// 1. Check recipients = sent + pending (or recipients = delivered + failed + pending)
	const expectedRecipientsFromSent = metrics.totalSent + metrics.pending;
	const expectedRecipientsFromStatus = metrics.delivered + metrics.failed + metrics.pending;
	
	if (metrics.totalRecipients === expectedRecipientsFromSent) {
		results.push({
			metric: "totalRecipients",
			status: "pass",
			message: `Total recipients correctly equals sent + pending (${expectedRecipientsFromSent})`,
		});
	} else if (metrics.totalRecipients === expectedRecipientsFromStatus) {
		results.push({
			metric: "totalRecipients",
			status: "pass",
			message: `Total recipients correctly equals delivered + failed + pending (${expectedRecipientsFromStatus})`,
		});
	} else {
		results.push({
			metric: "totalRecipients",
			status: "warning",
			expected: expectedRecipientsFromSent,
			actual: metrics.totalRecipients,
			message: `Total recipients (${metrics.totalRecipients}) doesn't match expected calculations. Expected: sent + pending = ${expectedRecipientsFromSent}, or delivered + failed + pending = ${expectedRecipientsFromStatus}`,
		});
	}

	// 2. Check sent = delivered + failed (pending messages are not yet sent)
	// Note: "Total Sent" typically excludes pending, as pending messages haven't been sent yet
	const expectedSentFromDelivered = metrics.delivered + metrics.failed;
	if (metrics.totalSent !== expectedSentFromDelivered) {
		results.push({
			metric: "totalSent",
			status: "warning",
			expected: expectedSentFromDelivered,
			actual: metrics.totalSent,
			message: `Total sent (${metrics.totalSent}) should equal delivered (${metrics.delivered}) + failed (${metrics.failed}) = ${expectedSentFromDelivered}. Pending messages (${metrics.pending}) are not yet sent.`,
		});
	} else {
		results.push({
			metric: "totalSent",
			status: "pass",
			message: `Total sent correctly equals delivered + failed (${expectedSentFromDelivered}). Pending messages excluded.`,
		});
	}

	// 3. Validate delivery rate
	if (metrics.deliveryRate !== undefined) {
		const expectedDeliveryRate = metrics.totalSent > 0
			? Math.round((metrics.delivered / metrics.totalSent) * 100 * 100) / 100
			: 0;
		const rateDiff = Math.abs(metrics.deliveryRate - expectedDeliveryRate);
		if (rateDiff > 0.01) {
			results.push({
				metric: "deliveryRate",
				status: "error",
				expected: expectedDeliveryRate,
				actual: metrics.deliveryRate,
				message: `Delivery rate (${metrics.deliveryRate}%) should be (${metrics.delivered} / ${metrics.totalSent}) * 100 = ${expectedDeliveryRate}%`,
			});
		} else {
			results.push({
				metric: "deliveryRate",
				status: "pass",
				message: `Delivery rate correctly calculated: ${metrics.deliveryRate}%`,
			});
		}
	}

	// 4. Validate failure rate
	if (metrics.failureRate !== undefined) {
		const expectedFailureRate = metrics.totalSent > 0
			? Math.round((metrics.failed / metrics.totalSent) * 100 * 100) / 100
			: 0;
		const rateDiff = Math.abs(metrics.failureRate - expectedFailureRate);
		if (rateDiff > 0.01) {
			results.push({
				metric: "failureRate",
				status: "error",
				expected: expectedFailureRate,
				actual: metrics.failureRate,
				message: `Failure rate (${metrics.failureRate}%) should be (${metrics.failed} / ${metrics.totalSent}) * 100 = ${expectedFailureRate}%`,
			});
		} else {
			results.push({
				metric: "failureRate",
				status: "pass",
				message: `Failure rate correctly calculated: ${metrics.failureRate}%`,
			});
		}
	}

	// 5. Validate response rate
	if (metrics.responseRate !== undefined) {
		const expectedResponseRate = metrics.delivered > 0
			? Math.round((metrics.responses / metrics.delivered) * 100 * 100) / 100
			: 0;
		const rateDiff = Math.abs(metrics.responseRate - expectedResponseRate);
		if (rateDiff > 0.01) {
			results.push({
				metric: "responseRate",
				status: "error",
				expected: expectedResponseRate,
				actual: metrics.responseRate,
				message: `Response rate (${metrics.responseRate}%) should be (${metrics.responses} / ${metrics.delivered}) * 100 = ${expectedResponseRate}%`,
			});
		} else {
			results.push({
				metric: "responseRate",
				status: "pass",
				message: `Response rate correctly calculated: ${metrics.responseRate}%`,
			});
		}
	}

	// 6. Validate conversion rate
	// Note: Conversion rate can be defined as:
	// - appointments / responses (standard definition in code)
	// - appointments / delivered (sometimes used in UI)
	if (metrics.conversionRate !== undefined) {
		const expectedConversionRateFromResponses = metrics.responses > 0
			? Math.round((metrics.appointments / metrics.responses) * 100 * 100) / 100
			: 0;
		const expectedConversionRateFromDelivered = metrics.delivered > 0
			? Math.round((metrics.appointments / metrics.delivered) * 100 * 100) / 100
			: 0;
		
		const rateDiffFromResponses = Math.abs(metrics.conversionRate - expectedConversionRateFromResponses);
		const rateDiffFromDelivered = Math.abs(metrics.conversionRate - expectedConversionRateFromDelivered);
		
		if (rateDiffFromResponses < 0.01) {
			results.push({
				metric: "conversionRate",
				status: "pass",
				message: `Conversion rate correctly calculated as appointments/responses: ${metrics.conversionRate}%`,
			});
		} else if (rateDiffFromDelivered < 0.01) {
			results.push({
				metric: "conversionRate",
				status: "warning",
				expected: expectedConversionRateFromResponses,
				actual: metrics.conversionRate,
				message: `Conversion rate (${metrics.conversionRate}%) appears to be calculated as appointments/delivered (${expectedConversionRateFromDelivered}%), but code expects appointments/responses (${expectedConversionRateFromResponses}%). Verify definition.`,
			});
		} else {
			results.push({
				metric: "conversionRate",
				status: "error",
				expected: expectedConversionRateFromResponses,
				actual: metrics.conversionRate,
				message: `Conversion rate (${metrics.conversionRate}%) doesn't match expected calculations. Expected: (${metrics.appointments} / ${metrics.responses}) * 100 = ${expectedConversionRateFromResponses}%, or (${metrics.appointments} / ${metrics.delivered}) * 100 = ${expectedConversionRateFromDelivered}%`,
			});
		}
	}

	// 7. Validate appointment set rate (appointments / responses)
	if (metrics.appointmentSetRate !== undefined) {
		const expectedAppointmentSetRate = metrics.responses > 0
			? Math.round((metrics.appointments / metrics.responses) * 100 * 100) / 100
			: 0;
		const rateDiff = Math.abs(metrics.appointmentSetRate - expectedAppointmentSetRate);
		if (rateDiff > 0.01) {
			results.push({
				metric: "appointmentSetRate",
				status: "warning",
				expected: expectedAppointmentSetRate,
				actual: metrics.appointmentSetRate,
				message: `Appointment set rate (${metrics.appointmentSetRate}%) should equal conversion rate: (${metrics.appointments} / ${metrics.responses}) * 100 = ${expectedAppointmentSetRate}%`,
			});
		} else {
			results.push({
				metric: "appointmentSetRate",
				status: "pass",
				message: `Appointment set rate correctly calculated: ${metrics.appointmentSetRate}%`,
			});
		}
	}

	// 8. Validate opt-out rate
	if (metrics.optOutRate !== undefined) {
		const expectedOptOutRate = metrics.delivered > 0
			? Math.round((metrics.optedOut / metrics.delivered) * 100 * 100) / 100
			: 0;
		const rateDiff = Math.abs(metrics.optOutRate - expectedOptOutRate);
		if (rateDiff > 0.01) {
			results.push({
				metric: "optOutRate",
				status: "error",
				expected: expectedOptOutRate,
				actual: metrics.optOutRate,
				message: `Opt-out rate (${metrics.optOutRate}%) should be (${metrics.optedOut} / ${metrics.delivered}) * 100 = ${expectedOptOutRate}%`,
			});
		} else {
			results.push({
				metric: "optOutRate",
				status: "pass",
				message: `Opt-out rate correctly calculated: ${metrics.optOutRate}%`,
			});
		}
	}

	// 9. Check logical constraints
	if (metrics.responses > metrics.delivered) {
		results.push({
			metric: "responses",
			status: "error",
			actual: metrics.responses,
			message: `Responses (${metrics.responses}) cannot exceed delivered (${metrics.delivered})`,
		});
	}

	if (metrics.appointments > metrics.responses) {
		results.push({
			metric: "appointments",
			status: "error",
			actual: metrics.appointments,
			message: `Appointments (${metrics.appointments}) cannot exceed responses (${metrics.responses})`,
		});
	}

	if (metrics.optedOut > metrics.delivered) {
		results.push({
			metric: "optedOut",
			status: "error",
			actual: metrics.optedOut,
			message: `Opted out (${metrics.optedOut}) cannot exceed delivered (${metrics.delivered})`,
		});
	}

	// 10. Check status breakdown percentages
	const statusTotal = metrics.delivered + metrics.failed + metrics.pending;
	if (statusTotal !== metrics.totalRecipients) {
		results.push({
			metric: "statusBreakdown",
			status: "warning",
			expected: metrics.totalRecipients,
			actual: statusTotal,
			message: `Status breakdown (delivered + failed + pending = ${statusTotal}) should equal total recipients (${metrics.totalRecipients})`,
		});
	}

	return results;
}

/**
 * Format audit results for display
 */
function formatAuditReport(results: AuditResult[]): string {
	const errors = results.filter((r) => r.status === "error");
	const warnings = results.filter((r) => r.status === "warning");
	const passes = results.filter((r) => r.status === "pass");

	let report = "\n=== BROADCAST METRICS AUDIT REPORT ===\n\n";

	report += `Summary:\n`;
	report += `  ✅ Passed: ${passes.length}\n`;
	report += `  ⚠️  Warnings: ${warnings.length}\n`;
	report += `  ❌ Errors: ${errors.length}\n\n`;

	if (errors.length > 0) {
		report += `\n❌ ERRORS:\n`;
		report += "─".repeat(60) + "\n";
		errors.forEach((result) => {
			report += `\n[${result.metric.toUpperCase()}]\n`;
			report += `  ${result.message}\n`;
			if (result.expected !== undefined && result.actual !== undefined) {
				report += `  Expected: ${result.expected}\n`;
				report += `  Actual: ${result.actual}\n`;
				report += `  Difference: ${Math.abs(result.expected - result.actual)}\n`;
			}
		});
	}

	if (warnings.length > 0) {
		report += `\n⚠️  WARNINGS:\n`;
		report += "─".repeat(60) + "\n";
		warnings.forEach((result) => {
			report += `\n[${result.metric.toUpperCase()}]\n`;
			report += `  ${result.message}\n`;
			if (result.expected !== undefined && result.actual !== undefined) {
				report += `  Expected: ${result.expected}\n`;
				report += `  Actual: ${result.actual}\n`;
			}
		});
	}

	if (passes.length > 0 && errors.length === 0 && warnings.length === 0) {
		report += `\n✅ ALL CHECKS PASSED:\n`;
		report += "─".repeat(60) + "\n";
		passes.forEach((result) => {
			report += `  ✓ ${result.metric}: ${result.message}\n`;
		});
	}

	report += "\n" + "=".repeat(60) + "\n";

	return report;
}

// Main execution
if (import.meta.main) {
	// Parse metrics from command line arguments or use provided metrics
	const providedMetrics: BroadcastMetrics = {
		totalRecipients: 3011,
		pending: 422,
		totalSent: 2589,
		delivered: 2583,
		failed: 6,
		responses: 204,
		appointments: 13,
		optedOut: 0,
		deliveryRate: 99.77,
		responseRate: 7.9,
		conversionRate: 0.5,
		failureRate: 0.23,
		optOutRate: 0,
		appointmentSetRate: 6.37,
	};

	console.log("Auditing broadcast metrics...\n");
	console.log("Input Metrics:");
	console.log(`  Total Recipients: ${providedMetrics.totalRecipients}`);
	console.log(`  Pending: ${providedMetrics.pending}`);
	console.log(`  Total Sent: ${providedMetrics.totalSent}`);
	console.log(`  Delivered: ${providedMetrics.delivered}`);
	console.log(`  Failed: ${providedMetrics.failed}`);
	console.log(`  Responses: ${providedMetrics.responses}`);
	console.log(`  Appointments: ${providedMetrics.appointments}`);
	console.log(`  Opted Out: ${providedMetrics.optedOut}`);
	console.log(`  Delivery Rate: ${providedMetrics.deliveryRate}%`);
	console.log(`  Response Rate: ${providedMetrics.responseRate}%`);
	console.log(`  Conversion Rate: ${providedMetrics.conversionRate}%`);
	console.log(`  Failure Rate: ${providedMetrics.failureRate}%`);
	console.log(`  Opt-out Rate: ${providedMetrics.optOutRate}%`);
	console.log(`  Appointment Set Rate: ${providedMetrics.appointmentSetRate}%`);

	const results = auditMetrics(providedMetrics);
	const report = formatAuditReport(results);

	console.log(report);

	// Exit with error code if there are errors
	if (results.some((r) => r.status === "error")) {
		process.exit(1);
	}
}

export { auditMetrics, formatAuditReport, type BroadcastMetrics, type AuditResult };
