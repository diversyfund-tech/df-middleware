/**
 * Test Double Booking Prevention
 * 
 * This script tests if GHL rejects double bookings by:
 * 1. Booking an appointment at 9am tomorrow (Jan 25, 2026)
 * 2. Attempting to book another appointment at the same time
 * 3. Reporting whether GHL allows or rejects the second booking
 */

import { bookAppointment } from "../src/lib/workflows/appointments/ghl-appointment";
import { getCalendarEvents } from "../src/lib/workflows/appointments/ghl-appointment";
import { getContact, createContact } from "../src/lib/ghl/client";
import { env } from "../src/env";

const CALENDAR_ID = "61acuXKr2rLLCWn8loyL";
const TEST_CONTACT_EMAIL = `test-double-booking-${Date.now()}@example.com`;
const TEST_CONTACT_PHONE = "+15551234567";

interface TestResult {
	step: string;
	success: boolean;
	message: string;
	data?: unknown;
	error?: string;
}

async function testDoubleBooking(): Promise<void> {
	const results: TestResult[] = [];

	console.log("\n=== GHL Double Booking Test ===\n");
	console.log(`Calendar ID: ${CALENDAR_ID}`);
	console.log(`Test Date: January 25, 2026 at 9:00 AM\n`);

	// Calculate appointment times
	// January 25, 2026 at 9:00 AM (assuming UTC, adjust timezone as needed)
	const appointmentDate = new Date("2026-01-25T09:00:00.000Z");
	const appointmentEnd = new Date(appointmentDate.getTime() + 60 * 60 * 1000); // 1 hour duration

	const startTime = appointmentDate.toISOString();
	const endTime = appointmentEnd.toISOString();

	console.log(`Appointment Time: ${startTime} to ${endTime}\n`);

	// Step 1: Create or get test contact
	console.log("Step 1: Creating/getting test contact...");
	let contactId: string;
	try {
		// Try to create a test contact
		const testContact = await createContact({
			email: TEST_CONTACT_EMAIL,
			phone: TEST_CONTACT_PHONE,
			firstName: "Test",
			lastName: "DoubleBooking",
		});
		contactId = testContact.id;
		results.push({
			step: "create_contact",
			success: true,
			message: `Created test contact: ${contactId}`,
			data: { contactId },
		});
		console.log(`✅ Created test contact: ${contactId}`);
	} catch (error) {
		// If contact already exists, try to find it
		const errorMsg = error instanceof Error ? error.message : String(error);
		if (errorMsg.includes("duplicate") || errorMsg.includes("already exists")) {
			// Try to search for existing contact
			const { searchContact } = await import("../src/lib/ghl/client");
			const existing = await searchContact(TEST_CONTACT_EMAIL, TEST_CONTACT_PHONE);
			if (existing) {
				contactId = existing.id;
				results.push({
					step: "get_existing_contact",
					success: true,
					message: `Using existing contact: ${contactId}`,
					data: { contactId },
				});
				console.log(`✅ Using existing contact: ${contactId}`);
			} else {
				throw new Error(`Could not create or find test contact: ${errorMsg}`);
			}
		} else {
			throw error;
		}
	}

	// Step 2: Check existing appointments at this time
	console.log("\nStep 2: Checking existing appointments at this time...");
	try {
		const existingAppointments = await getCalendarEvents(
			startTime,
			endTime,
			CALENDAR_ID
		);
		
		const conflicts = existingAppointments.filter(apt => {
			const aptStart = new Date(apt.startTime);
			const aptEnd = new Date(apt.endTime);
			return (appointmentDate < aptEnd && appointmentEnd > aptStart);
		});

		results.push({
			step: "check_existing",
			success: true,
			message: `Found ${conflicts.length} existing appointment(s) at this time`,
			data: {
				totalAppointments: existingAppointments.length,
				conflicts: conflicts.length,
				conflictDetails: conflicts.map(apt => ({
					id: apt.id,
					title: apt.title,
					startTime: apt.startTime,
					endTime: apt.endTime,
					contactId: apt.contactId,
				})),
			},
		});

		if (conflicts.length > 0) {
			console.log(`⚠️  Found ${conflicts.length} existing appointment(s) at this time:`);
			for (const apt of conflicts) {
				console.log(`   - ${apt.id}: ${apt.title} (${apt.startTime} to ${apt.endTime})`);
			}
			console.log("\n⚠️  WARNING: There are already appointments at this time!");
			console.log("   We'll still try to book to see if GHL rejects it.\n");
		} else {
			console.log(`✅ No existing appointments at this time\n`);
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		results.push({
			step: "check_existing",
			success: false,
			message: "Failed to check existing appointments",
			error: errorMsg,
		});
		console.log(`⚠️  Could not check existing appointments: ${errorMsg}\n`);
	}

	// Step 3: Book first appointment
	console.log("Step 3: Booking first appointment...");
	let firstAppointmentId: string | null = null;
	try {
		const firstAppointment = await bookAppointment({
			contactId,
			calendarId: CALENDAR_ID,
			startTime,
			endTime,
			title: "Test Appointment #1 - Double Booking Test",
			notes: "First appointment for double booking test",
		});

		firstAppointmentId = firstAppointment.id;
		results.push({
			step: "book_first",
			success: true,
			message: `Successfully booked first appointment: ${firstAppointmentId}`,
			data: {
				appointmentId: firstAppointmentId,
				startTime: firstAppointment.startTime,
				endTime: firstAppointment.endTime,
				title: firstAppointment.title,
			},
		});
		console.log(`✅ Successfully booked first appointment: ${firstAppointmentId}`);
		console.log(`   Title: ${firstAppointment.title}`);
		console.log(`   Time: ${firstAppointment.startTime} to ${firstAppointment.endTime}\n`);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		results.push({
			step: "book_first",
			success: false,
			message: "Failed to book first appointment",
			error: errorMsg,
		});
		console.error(`❌ Failed to book first appointment: ${errorMsg}\n`);
		throw error;
	}

	// Wait a moment to ensure the first booking is processed
	console.log("Waiting 2 seconds for first appointment to be processed...");
	await new Promise(resolve => setTimeout(resolve, 2000));

	// Step 4: Attempt to book second appointment at the same time
	console.log("Step 4: Attempting to book second appointment at the same time...");
	try {
		const secondAppointment = await bookAppointment({
			contactId,
			calendarId: CALENDAR_ID,
			startTime,
			endTime,
			title: "Test Appointment #2 - Double Booking Test",
			notes: "Second appointment attempt - should be rejected if GHL prevents double bookings",
		});

		results.push({
			step: "book_second",
			success: true,
			message: `⚠️  GHL ALLOWED double booking! Second appointment created: ${secondAppointment.id}`,
			data: {
				appointmentId: secondAppointment.id,
				startTime: secondAppointment.startTime,
				endTime: secondAppointment.endTime,
				title: secondAppointment.title,
			},
		});
		console.log(`⚠️  ⚠️  ⚠️  DOUBLE BOOKING ALLOWED ⚠️  ⚠️  ⚠️`);
		console.log(`   GHL did NOT reject the second appointment!`);
		console.log(`   Second appointment ID: ${secondAppointment.id}`);
		console.log(`   This confirms GHL allows overlapping appointments.\n`);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const statusMatch = errorMsg.match(/\((\d+)\)/);
		const statusCode = statusMatch ? parseInt(statusMatch[1]) : null;

		results.push({
			step: "book_second",
			success: false,
			message: `✅ GHL REJECTED double booking!`,
			error: errorMsg,
			data: {
				statusCode,
				rejected: true,
			},
		});
		console.log(`✅ GHL REJECTED the second appointment!`);
		console.log(`   Error: ${errorMsg}`);
		if (statusCode) {
			console.log(`   Status Code: ${statusCode}`);
		}
		console.log(`   This confirms GHL prevents double bookings.\n`);
	}

	// Step 5: Verify final state
	console.log("Step 5: Verifying final appointment state...");
	try {
		const finalAppointments = await getCalendarEvents(
			startTime,
			endTime,
			CALENDAR_ID
		);

		const overlapping = finalAppointments.filter(apt => {
			const aptStart = new Date(apt.startTime);
			const aptEnd = new Date(apt.endTime);
			return (appointmentDate < aptEnd && appointmentEnd > aptStart);
		});

		results.push({
			step: "verify_final",
			success: true,
			message: `Found ${overlapping.length} appointment(s) at this time slot`,
			data: {
				totalAppointments: finalAppointments.length,
				overlapping: overlapping.length,
				appointments: overlapping.map(apt => ({
					id: apt.id,
					title: apt.title,
					startTime: apt.startTime,
					endTime: apt.endTime,
					contactId: apt.contactId,
					status: apt.status,
				})),
			},
		});

		console.log(`Final state: ${overlapping.length} appointment(s) at this time slot`);
		for (const apt of overlapping) {
			console.log(`   - ${apt.id}: ${apt.title} (${apt.startTime} to ${apt.endTime})`);
		}
		console.log("");
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		results.push({
			step: "verify_final",
			success: false,
			message: "Failed to verify final state",
			error: errorMsg,
		});
	}

	// Print summary
	console.log("\n=== TEST SUMMARY ===\n");
	for (const result of results) {
		const icon = result.success ? "✅" : "❌";
		console.log(`${icon} ${result.step}: ${result.message}`);
		if (result.error) {
			console.log(`   Error: ${result.error}`);
		}
		if (result.data && typeof result.data === "object") {
			console.log(`   Data:`, JSON.stringify(result.data, null, 2));
		}
		console.log("");
	}

	// Final conclusion
	const secondBookingResult = results.find(r => r.step === "book_second");
	if (secondBookingResult?.success) {
		console.log("🔴 CONCLUSION: GHL ALLOWS DOUBLE BOOKINGS");
		console.log("   The calendar is configured to allow overlapping appointments.");
		console.log("   You need to add client-side validation to prevent double bookings.\n");
	} else if (secondBookingResult && !secondBookingResult.success) {
		console.log("🟢 CONCLUSION: GHL PREVENTS DOUBLE BOOKINGS");
		console.log("   GHL's API rejects overlapping appointments.");
		console.log("   However, you should still add client-side validation for better UX.\n");
	}
}

// Run test
if (require.main === module) {
	testDoubleBooking()
		.then(() => {
			console.log("=== TEST COMPLETE ===");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n=== TEST FAILED ===");
			console.error(error);
			process.exit(1);
		});
}

export { testDoubleBooking };
