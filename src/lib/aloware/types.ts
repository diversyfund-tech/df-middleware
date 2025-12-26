/**
 * Aloware API Type Definitions
 */

export interface AlowareUser {
	id: string;
	name?: string;
	email?: string;
	status?: string;
	[key: string]: unknown;
}

export interface AlowareContact {
	id: string;
	phone_number?: string;
	email?: string;
	first_name?: string;
	last_name?: string;
	timezone?: string;
	lead_source?: string;
	intake_source?: string;
	disposition_status?: string;
	is_dnc?: boolean;
	is_blocked?: boolean;
	text_authorized?: boolean;
	country?: string;
	state?: string;
	city?: string;
	external_ids?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface AlowareCall {
	id: string;
	contact_id?: string;
	user_id?: string;
	direction?: "inbound" | "outbound";
	type?: string;
	disposition?: string;
	status?: string;
	resolution?: string;
	duration?: number;
	talk_time?: number;
	wait_time?: number;
	hold_time?: number;
	csat_score?: number;
	has_recording?: boolean;
	has_transcription?: boolean;
	has_voicemail?: boolean;
	recording_url?: string;
	voicemail_url?: string;
	created_at?: string;
	ended_at?: string;
	[key: string]: unknown;
}

export interface AlowareCallList {
	id: string;
	name: string;
	description?: string;
	contact_ids?: string[];
	[key: string]: unknown;
}

export interface AlowareWebhookEvent {
	event: string;
	body: {
		id?: string;
		contact?: AlowareContact;
		user?: AlowareUser;
		communication_id?: string;
		contact_id?: string;
		user_id?: string;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}


