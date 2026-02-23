/**
 * Appointment Validator
 * 
 * Validates appointment details before booking.
 */

import { getCalendarEvents } from "./ghl-appointment";

export interface AppointmentValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Validate appointment parameters
 */
export function validateAppointmentParams(params: {
	contactId?: string;
	startTime?: string;
	endTime?: string;
	title?: string;
}): AppointmentValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Required fields
	if (!params.contactId) {
		errors.push("contactId is required");
	}
	if (!params.startTime) {
		errors.push("startTime is required");
	}
	if (!params.endTime) {
		errors.push("endTime is required");
	}
	if (!params.title) {
		errors.push("title is required");
	}

	// Validate time format
	if (params.startTime && !isValidISOString(params.startTime)) {
		errors.push("startTime must be a valid ISO 8601 timestamp");
	}
	if (params.endTime && !isValidISOString(params.endTime)) {
		errors.push("endTime must be a valid ISO 8601 timestamp");
	}

	// Validate time logic
	if (params.startTime && params.endTime && isValidISOString(params.startTime) && isValidISOString(params.endTime)) {
		const start = new Date(params.startTime);
		const end = new Date(params.endTime);

		if (start >= end) {
			errors.push("endTime must be after startTime");
		}

		// Check if appointment is in the past
		if (start < new Date()) {
			warnings.push("Appointment start time is in the past");
		}

		// Check minimum duration (15 minutes)
		const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
		if (durationMinutes < 15) {
			warnings.push("Appointment duration is less than 15 minutes");
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Check if appointment time conflicts with existing appointments
 */
export async function checkAvailability(
	startTime: string,
	endTime: string,
	calendarId?: string
): Promise<{ available: boolean; conflicts: number }> {
	try {
		const events = await getCalendarEvents(startTime, endTime, calendarId);
		
		// Check for overlapping appointments
		const start = new Date(startTime);
		const end = new Date(endTime);
		
		const conflicts = events.filter(event => {
			const eventStart = new Date(event.startTime);
			const eventEnd = new Date(event.endTime);
			
			// Check for overlap
			return (start < eventEnd && end > eventStart);
		});

		return {
			available: conflicts.length === 0,
			conflicts: conflicts.length,
		};
	} catch (error) {
		console.error("[appointment-validator] Error checking availability:", error);
		// If we can't check, assume available (don't block booking)
		return {
			available: true,
			conflicts: 0,
		};
	}
}

/**
 * Validate ISO 8601 timestamp
 */
function isValidISOString(dateString: string): boolean {
	try {
		const date = new Date(dateString);
		return date.toISOString() === dateString || !isNaN(date.getTime());
	} catch {
		return false;
	}
}

/**
 * Format time for display
 */
export function formatAppointmentTime(isoString: string): string {
	try {
		const date = new Date(isoString);
		return date.toLocaleString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZoneName: "short",
		});
	} catch {
		return isoString;
	}
}
