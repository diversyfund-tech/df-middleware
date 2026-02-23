/**
 * Test Double Booking Prevention
 * 
 * GET /api/test/test-double-booking
 * 
 * Tests if GHL rejects double bookings by:
 * 1. Booking an appointment at 9am tomorrow (Jan 25, 2026)
 * 2. Attempting to book another appointment at the same time
 * 3. Reporting whether GHL allows or rejects the second booking
 */

import { NextRequest, NextResponse } from "next/server";
import { bookAppointment } from "@/lib/workflows/appointments/ghl-appointment";
import { getCalendarEvents } from "@/lib/workflows/appointments/ghl-appointment";
import { createContact, searchContact } from "@/lib/ghl/client";

export const dynamic = "force-dynamic";

const CALENDAR_ID = "61acuXKr2rLLCWn8loyL";

export async function GET(req: NextRequest) {
	try {
		const results: Array<{ step: string; success: boolean; message: string; data?: unknown; error?: string }> = [];

		console.log("\n=== GHL Double Booking Test ===\n");
		console.log(`Calendar ID: ${CALENDAR_ID}`);
		console.log(`Test Date: January 25, 2026 at 9:00 AM\n`);

		// Calculate appointment times
		// January 25, 2026 at 9:00 AM UTC
		const appointmentDate = new Date("2026-01-25T09:00:00.000Z");
		const appointmentEnd = new Date(appointmentDate.getTime() + 60 * 60 * 1000); // 1 hour duration

		const startTime = appointmentDate.toISOString();
		const endTime = appointmentEnd.toISOString();

		console.log(`Appointment Time: ${startTime} to ${endTime}\n`);

		// Step 1: Create or get test contact
		console.log("Step 1: Creating/getting test contact...");
		const testEmail = `test-double-booking-${Date.now()}@example.com`;
		const testPhone = "+15551234567";
		
		let contactId: string;
		try {
			const testContact = await createContact({
				email: testEmail,
				phone: testPhone,
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
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg.includes("duplicate") || errorMsg.includes("already exists")) {
				const existing = await searchContact(testEmail, testPhone);
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
				console.log(`⚠️  Found ${conflicts.length} existing appointment(s) at this time`);
			} else {
				console.log(`✅ No existing appointments at this time`);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			results.push({
				step: "check_existing",
				success: false,
				message: "Failed to check existing appointments",
				error: errorMsg,
			});
		}

		// Step 3: Book first appointment
		console.log("\nStep 3: Booking first appointment...");
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
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			results.push({
				step: "book_first",
				success: false,
				message: "Failed to book first appointment",
				error: errorMsg,
			});
			return NextResponse.json({
				error: "Failed to book first appointment",
				results,
			}, { status: 500 });
		}

		// Wait a moment to ensure the first booking is processed
		console.log("\nWaiting 2 seconds for first appointment to be processed...");
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Step 4: Attempt to book second appointment at the same time
		console.log("\nStep 4: Attempting to book second appointment at the same time...");
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
		}

		// Step 5: Verify final state
		console.log("\nStep 5: Verifying final appointment state...");
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
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			results.push({
				step: "verify_final",
				success: false,
				message: "Failed to verify final state",
				error: errorMsg,
			});
		}

		// Determine conclusion
		const secondBookingResult = results.find(r => r.step === "book_second");
		const conclusion = secondBookingResult?.success
			? "GHL ALLOWS DOUBLE BOOKINGS - Calendar is configured to allow overlapping appointments"
			: secondBookingResult && !secondBookingResult.success
			? "GHL PREVENTS DOUBLE BOOKINGS - GHL's API rejects overlapping appointments"
			: "Unable to determine";

		return NextResponse.json({
			success: true,
			conclusion,
			results,
			summary: {
				firstAppointmentId,
				calendarId: CALENDAR_ID,
				testTime: startTime,
			},
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("[test-double-booking] Error:", error);
		return NextResponse.json({
			error: errorMessage,
		}, { status: 500 });
	}
}
