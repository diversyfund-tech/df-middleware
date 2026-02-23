/**
 * GHL Appointment Booking
 * 
 * Handles appointment booking via GHL API (direct calls, not MCP).
 */

import { ghlRequest } from "@/lib/ghl/client";
import { env } from "@/env";
import type { GHLAppointment } from "@/lib/ghl/types";

export interface AppointmentBookingParams {
	contactId: string;
	calendarId?: string; // Defaults to GHL_CALENDAR_ID from env
	startTime: string; // ISO timestamp
	endTime: string; // ISO timestamp
	title: string;
	notes?: string;
	assignedTo?: string; // User ID
}

/**
 * Book an appointment in GHL
 */
export async function bookAppointment(
	params: AppointmentBookingParams
): Promise<GHLAppointment> {
	const locationId = env.GHL_LOCATION_ID;
	const calendarId = params.calendarId || env.GHL_CALENDAR_ID;

	if (!locationId) {
		throw new Error("GHL_LOCATION_ID is not configured");
	}

	if (!calendarId) {
		throw new Error("GHL_CALENDAR_ID is not configured");
	}

	try {
		const endpoint = "/calendars/appointments";
		const body = {
			locationId,
			calendarId,
			contactId: params.contactId,
			startTime: params.startTime,
			endTime: params.endTime,
			title: params.title,
			notes: params.notes,
			assignedTo: params.assignedTo,
		};

		const response = await ghlRequest<GHLAppointment | { appointment?: GHLAppointment; id?: string; data?: GHLAppointment }>(
			endpoint,
			{
				method: "POST",
				body: JSON.stringify(body),
			}
		);

		// Handle different response structures
		if ((response as { appointment?: GHLAppointment }).appointment) {
			return (response as { appointment: GHLAppointment }).appointment;
		}
		if ((response as { id?: string }).id) {
			// If we only got an ID, fetch the full appointment
			return getAppointment((response as { id: string }).id);
		}
		if ((response as { data?: GHLAppointment }).data) {
			return (response as { data: GHLAppointment }).data;
		}

		// If response is directly an appointment object
		if ((response as GHLAppointment).id) {
			return response as GHLAppointment;
		}

		throw new Error("Invalid response structure from GHL API");
	} catch (error) {
		console.error("[GHL] Error booking appointment:", error);
		throw error;
	}
}

/**
 * Get appointment by ID
 */
export async function getAppointment(appointmentId: string): Promise<GHLAppointment> {
	try {
		const endpoint = `/calendars/appointments/${appointmentId}`;
		const response = await ghlRequest<GHLAppointment | { appointment?: GHLAppointment; data?: GHLAppointment }>(
			endpoint
		);

		if ((response as { appointment?: GHLAppointment }).appointment) {
			return (response as { appointment: GHLAppointment }).appointment;
		}
		if ((response as { data?: GHLAppointment }).data) {
			return (response as { data: GHLAppointment }).data;
		}

		if ((response as GHLAppointment).id) {
			return response as GHLAppointment;
		}

		throw new Error("Invalid response structure from GHL API");
	} catch (error) {
		console.error("[GHL] Error fetching appointment:", error);
		throw error;
	}
}

/**
 * Get calendar events (appointments) for a date range
 */
export async function getCalendarEvents(
	startTime: string,
	endTime: string,
	calendarId?: string
): Promise<GHLAppointment[]> {
	const locationId = env.GHL_LOCATION_ID;
	const calId = calendarId || env.GHL_CALENDAR_ID;

	if (!locationId) {
		throw new Error("GHL_LOCATION_ID is not configured");
	}

	if (!calId) {
		throw new Error("GHL_CALENDAR_ID is not configured");
	}

	try {
		const endpoint = `/calendars/${calId}/events`;
		const queryParams = new URLSearchParams({
			locationId,
			startTime,
			endTime,
		});

		const response = await ghlRequest<{ appointments?: GHLAppointment[]; events?: GHLAppointment[]; data?: GHLAppointment[] }>(
			`${endpoint}?${queryParams.toString()}`
		);

		if ((response as { appointments?: GHLAppointment[] }).appointments) {
			return (response as { appointments: GHLAppointment[] }).appointments;
		}
		if ((response as { events?: GHLAppointment[] }).events) {
			return (response as { events: GHLAppointment[] }).events;
		}
		if ((response as { data?: GHLAppointment[] }).data) {
			return (response as { data: GHLAppointment[] }).data;
		}

		// If response is directly an array
		if (Array.isArray(response)) {
			return response as GHLAppointment[];
		}

		return [];
	} catch (error) {
		console.error("[GHL] Error fetching calendar events:", error);
		return [];
	}
}
