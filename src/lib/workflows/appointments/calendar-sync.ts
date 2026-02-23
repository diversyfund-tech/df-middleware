/**
 * Calendar Sync
 * 
 * Syncs appointments to calendars and stores appointment mappings.
 * For now, just handles GHL calendar. Future: Google Calendar, Outlook, etc.
 */

import { bookAppointment, getAppointment } from "./ghl-appointment";
import type { GHLAppointment } from "@/lib/ghl/types";

/**
 * Book appointment and store mapping
 * 
 * @param params - Appointment booking parameters
 * @returns Appointment details with mapping information
 */
export async function bookAndSyncAppointment(params: {
	contactId: string;
	calendarId?: string;
	startTime: string;
	endTime: string;
	title: string;
	notes?: string;
	assignedTo?: string;
}): Promise<{
	appointment: GHLAppointment;
	calendarType: "ghl";
}> {
	// Book appointment in GHL
	const appointment = await bookAppointment(params);

	// For now, we only sync to GHL calendar
	// Future: Add Google Calendar, Outlook, etc. sync here

	return {
		appointment,
		calendarType: "ghl",
	};
}

/**
 * Get appointment by ID
 */
export async function getAppointmentById(appointmentId: string): Promise<GHLAppointment | null> {
	try {
		return await getAppointment(appointmentId);
	} catch (error) {
		console.error("[calendar-sync] Error fetching appointment:", error);
		return null;
	}
}
