/**
 * Constants used throughout the application
 * 
 * Centralized location for all magic strings and constant values
 */

/**
 * Webhook event sources
 */
export const WEBHOOK_SOURCES = {
	GHL: "ghl",
	ALOWARE: "aloware",
	TEXTING: "texting",
	BROADCAST: "broadcast",
} as const;

/**
 * Webhook event statuses
 */
export const WEBHOOK_EVENT_STATUS = {
	PENDING: "pending",
	PROCESSING: "processing",
	DONE: "done",
	ERROR: "error",
	SKIPPED: "skipped",
} as const;

/**
 * Sync directions
 */
export const SYNC_DIRECTION = {
	ALOWARE_TO_GHL: "aloware_to_ghl",
	GHL_TO_ALOWARE: "ghl_to_aloware",
	BIDIRECTIONAL: "bidirectional",
} as const;

/**
 * Entity types
 */
export const ENTITY_TYPE = {
	CONTACT: "contact",
	CALL: "call",
	MESSAGE: "message",
	LIST: "list",
	TAG: "tag",
	APPOINTMENT: "appointment",
	TRANSCRIPTION: "transcription",
	CALL_SUMMARY: "call_summary",
	RECORDING: "recording",
	VOICEMAIL: "voicemail",
	COMMUNICATION: "communication",
	OPPORTUNITY: "opportunity",
} as const;

/**
 * Sync operation statuses
 */
export const SYNC_STATUS = {
	SUCCESS: "success",
	ERROR: "error",
	SKIPPED: "skipped",
} as const;

/**
 * Opt-out registry statuses
 */
export const OPTOUT_STATUS = {
	OPTED_OUT: "opted_out",
	OPTED_IN: "opted_in",
} as const;

/**
 * Opt-out sources
 */
export const OPTOUT_SOURCE = {
	TEXTING: "texting",
	GHL: "ghl",
	MANUAL: "manual",
} as const;

/**
 * Agent list keys
 */
export const AGENT_LIST_KEYS = {
	CALL_NOW: "CALL_NOW",
	NEW_LEADS: "NEW_LEADS",
	FOLLOW_UP: "FOLLOW_UP",
	HOT: "HOT",
} as const;

/**
 * Default agent key
 */
export const DEFAULT_AGENT_KEY = "UNASSIGNED";

/**
 * GHL event types
 */
export const GHL_EVENT_TYPES = {
	CONTACT_CREATED: "contact.created",
	CONTACT_UPDATED: "contact.updated",
	CONTACT_CHANGED: "contact.changed",
	CONTACT_DELETED: "contact.deleted",
	TAG_ADDED: "tag.added",
	TAG_REMOVED: "tag.removed",
	APPOINTMENT_CREATED: "appointment.created",
	APPOINTMENT_UPDATED: "appointment.updated",
	OPPORTUNITY_STATUS_CHANGED: "opportunity.statusChanged",
	PIPELINE_STAGE_CHANGED: "pipeline.stageChanged",
} as const;

/**
 * Aloware event types (patterns)
 */
export const ALOWARE_EVENT_PATTERNS = {
	CONTACT: "Contact",
	CALL: "Call",
	PHONE_CALL: "PhoneCall",
	TRANSCRIPTION: "transcription",
	CALL_SUMMARY: "CallSummarized",
	RECORDING: "Recording",
	VOICEMAIL: "Voicemail",
	COMMUNICATION: "Communication",
	APPOINTMENT: "Appointment",
	DNC: "DNC",
	DO_NOT_CALL: "DoNotCall",
} as const;

/**
 * Job queue names
 */
export const JOB_QUEUE_NAMES = {
	WEBHOOK_EVENT: "process-webhook-event",
	BROADCAST_EVENT: "process-broadcast-event",
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
	OK: 200,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	INTERNAL_SERVER_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Error codes
 */
export const ERROR_CODES = {
	PROXY_ERROR: "PROXY_ERROR",
	AUTH_ERROR: "AUTH_ERROR",
	VALIDATION_ERROR: "VALIDATION_ERROR",
	SYNC_ERROR: "SYNC_ERROR",
	WEBHOOK_ERROR: "WEBHOOK_ERROR",
} as const;
