/**
 * GHL API Type Definitions
 */

export interface GHLContact {
	id: string;
	email?: string;
	phone?: string;
	firstName?: string;
	lastName?: string;
	address1?: string;
	address2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
	tags?: string[];
	customFields?: Record<string, unknown>;
	dateAdded?: string;
	dateUpdated?: string;
	updatedAt?: string;
	owner?: string | { id?: string; email?: string; name?: string } | null; // GHL owner (can be ID string or object)
	[key: string]: unknown;
}

export interface GHLAppointment {
	id: string;
	calendarId: string;
	contactId: string;
	startTime: string;
	endTime: string;
	title: string;
	notes?: string;
	status: string;
	confirmationUrl?: string;
	meetingUrl?: string;
	[key: string]: unknown;
}

export interface GHLCalendar {
	id: string;
	name: string;
	timezone?: string;
	locationId?: string;
}

export interface GHLWebhookEvent {
	event: string;
	contact?: GHLContact;
	appointment?: GHLAppointment;
	[key: string]: unknown;
}


