import {
	text,
	uuid,
	timestamp,
	pgTable,
	index,
	uniqueIndex,
	jsonb,
	boolean,
} from "drizzle-orm/pg-core";

/**
 * Webhook Events Table
 * Stores incoming webhook events from both GHL and Aloware for async processing
 */
export const webhookEvents = pgTable(
	"webhook_events",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
		source: text("source").notNull(), // 'ghl' | 'aloware'
		eventType: text("event_type").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		payloadJson: jsonb("payload_json").notNull(),
		dedupeKey: text("dedupe_key").notNull(),
		status: text("status").default("pending").notNull(), // 'pending' | 'processing' | 'done' | 'error'
		errorMessage: text("error_message"),
		processedAt: timestamp("processed_at", { withTimezone: true }),
	},
	(table) => ({
		dedupeKeyUnique: uniqueIndex("webhook_events_dedupe_key_unique").on(table.dedupeKey),
		statusIdx: index("webhook_events_status_idx").on(table.status),
		sourceStatusIdx: index("webhook_events_source_status_idx").on(table.source, table.status),
		receivedAtIdx: index("webhook_events_received_at_idx").on(table.receivedAt),
		entityIdx: index("webhook_events_entity_idx").on(table.entityType, table.entityId),
	}),
);

/**
 * Sync Log Table
 * Tracks all sync operations between GHL and Aloware
 */
export const syncLog = pgTable(
	"sync_log",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		direction: text("direction").notNull(), // 'aloware_to_ghl' | 'ghl_to_aloware'
		entityType: text("entity_type").notNull(), // 'contact' | 'call' | 'list'
		entityId: text("entity_id").notNull(),
		sourceId: text("source_id").notNull(), // ID from source system
		targetId: text("target_id"), // ID in target system (if created/updated)
		status: text("status").notNull(), // 'success' | 'error'
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		correlationId: text("correlation_id"), // Links to webhook event or batch run
	},
	(table) => ({
		entityIdx: index("sync_log_entity_idx").on(table.entityType, table.entityId),
		directionIdx: index("sync_log_direction_idx").on(table.direction),
		startedAtIdx: index("sync_log_started_at_idx").on(table.startedAt),
		correlationIdx: index("sync_log_correlation_idx").on(table.correlationId),
	}),
);

/**
 * Sync State Table
 * Tracks cursor position for reconciliation batches
 */
export const syncState = pgTable("sync_state", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	direction: text("direction").notNull(), // 'aloware_to_ghl' | 'ghl_to_aloware'
	entityType: text("entity_type").notNull(), // 'contact' | 'call' | 'list'
	cursorUpdatedAt: timestamp("cursor_updated_at", { withTimezone: true }).defaultNow().notNull(),
	cursorId: text("cursor_id"), // Last processed ID or timestamp
	lastRunAt: timestamp("last_run_at", { withTimezone: true }).defaultNow().notNull(),
	lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
}, (table) => ({
	directionEntityIdx: uniqueIndex("sync_state_direction_entity_unique").on(
		table.direction,
		table.entityType,
	),
}));

/**
 * Contact Mappings Table
 * Maps Aloware contact IDs to GHL contact IDs for bidirectional sync
 */
export const contactMappings = pgTable(
	"contact_mappings",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		alowareContactId: text("aloware_contact_id"), // Nullable for texting-only contacts
		ghlContactId: text("ghl_contact_id").notNull(),
		// Match keys for deduplication
		phoneNumber: text("phone_number"),
		email: text("email"),
		// Sync metadata
		lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
		syncDirection: text("sync_direction").notNull(), // 'aloware_to_ghl' | 'ghl_to_aloware' | 'bidirectional'
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		alowareContactIdIdx: uniqueIndex("contact_mappings_aloware_contact_id_unique").on(
			table.alowareContactId,
		),
		ghlContactIdIdx: uniqueIndex("contact_mappings_ghl_contact_id_unique").on(
			table.ghlContactId,
		),
		phoneIdx: index("contact_mappings_phone_idx").on(table.phoneNumber),
		emailIdx: index("contact_mappings_email_idx").on(table.email),
	}),
);

/**
 * Texting Webhook Events Table
 * Stores incoming webhook events from texting system
 */
export const textingWebhookEvents = pgTable(
	"texting_webhook_events",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
		eventType: text("event_type").notNull(),
		entityType: text("entity_type").default("message").notNull(),
		entityId: text("entity_id"),
		conversationId: text("conversation_id"),
		fromNumber: text("from_number"),
		toNumber: text("to_number"),
		payloadJson: jsonb("payload_json").notNull(),
		dedupeKey: text("dedupe_key").notNull(),
		status: text("status").default("pending").notNull(), // 'pending' | 'processing' | 'done' | 'error'
		errorMessage: text("error_message"),
		processedAt: timestamp("processed_at", { withTimezone: true }),
	},
	(table) => ({
		dedupeKeyUnique: uniqueIndex("texting_webhook_events_dedupe_key_unique").on(table.dedupeKey),
		statusIdx: index("texting_webhook_events_status_idx").on(table.status),
		receivedAtIdx: index("texting_webhook_events_received_at_idx").on(table.receivedAt),
		entityIdIdx: index("texting_webhook_events_entity_id_idx").on(table.entityId),
		conversationIdIdx: index("texting_webhook_events_conversation_id_idx").on(table.conversationId),
		fromNumberIdx: index("texting_webhook_events_from_number_idx").on(table.fromNumber),
	}),
);

/**
 * Message Mappings Table
 * Maps messages across texting system, GHL, and Aloware
 */
export const messageMappings = pgTable(
	"message_mappings",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		textingMessageId: text("texting_message_id"),
		ghlMessageId: text("ghl_message_id"),
		alowareMessageId: text("aloware_message_id"),
		conversationId: text("conversation_id"),
		ghlContactId: text("ghl_contact_id"),
		alowareContactId: text("aloware_contact_id"),
		fromNumber: text("from_number"),
		toNumber: text("to_number"),
		direction: text("direction"), // 'inbound' | 'outbound'
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		textingMessageIdIdx: uniqueIndex("message_mappings_texting_message_id_unique").on(
			table.textingMessageId,
		),
		ghlMessageIdIdx: uniqueIndex("message_mappings_ghl_message_id_unique").on(table.ghlMessageId),
		alowareMessageIdIdx: uniqueIndex("message_mappings_aloware_message_id_unique").on(
			table.alowareMessageId,
		),
		conversationIdIdx: index("message_mappings_conversation_id_idx").on(table.conversationId),
		ghlContactIdIdx: index("message_mappings_ghl_contact_id_idx").on(table.ghlContactId),
		alowareContactIdIdx: index("message_mappings_aloware_contact_id_idx").on(table.alowareContactId),
		fromNumberIdx: index("message_mappings_from_number_idx").on(table.fromNumber),
		toNumberIdx: index("message_mappings_to_number_idx").on(table.toNumber),
	}),
);

/**
 * Opt-Out Registry Table
 * Authoritative do-not-text list + audit trail
 */
export const optoutRegistry = pgTable(
	"optout_registry",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		phoneNumber: text("phone_number").notNull(), // E.164 format
		status: text("status").notNull(), // 'opted_out' | 'opted_in'
		source: text("source").notNull(), // 'texting' | 'ghl' | 'manual'
		reason: text("reason"), // 'STOP' | 'HELP' | 'other'
		lastEventAt: timestamp("last_event_at", { withTimezone: true }).defaultNow().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		phoneNumberUnique: uniqueIndex("optout_registry_phone_number_unique").on(table.phoneNumber),
		statusIdx: index("optout_registry_status_idx").on(table.status),
	}),
);

/**
 * Reconcile Runs Table
 * Tracks reconciliation job execution
 */
export const reconcileRuns = pgTable("reconcile_runs", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	jobName: text("job_name").notNull(),
	startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true }),
	status: text("status").notNull(), // 'running' | 'success' | 'error'
	totals: jsonb("totals"), // JSON object with counts
	errorMessage: text("error_message"),
}, (table) => ({
	jobNameIdx: index("reconcile_runs_job_name_idx").on(table.jobName),
	startedAtIdx: index("reconcile_runs_started_at_idx").on(table.startedAt),
}));

/**
 * Quarantine Events Table
 * Stores quarantined events that should be excluded from processing
 */
export const quarantineEvents = pgTable(
	"quarantine_events",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		eventId: text("event_id").notNull(),
		eventSource: text("event_source").notNull(), // 'webhook' | 'texting'
		reason: text("reason").notNull(),
		quarantinedAt: timestamp("quarantined_at", { withTimezone: true }).defaultNow().notNull(),
		quarantinedBy: text("quarantined_by"), // Optional admin identifier
	},
	(table) => ({
		eventIdIdx: index("quarantine_events_event_id_idx").on(table.eventId),
		eventSourceIdx: index("quarantine_events_event_source_idx").on(table.eventSource),
	}),
);

/**
 * Agent Directory Table
 * Maps agent keys to GHL identifiers for agent resolution
 */
export const agentDirectory = pgTable(
	"agent_directory",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		agentKey: text("agent_key").notNull(), // 'CHRIS' | 'RAFI' | 'UNASSIGNED'
		displayName: text("display_name").notNull(),
		ghlOwnerId: text("ghl_owner_id"), // GHL owner ID
		ghlOwnerEmail: text("ghl_owner_email"), // GHL owner email
		ghlAssignedAgentFieldValue: text("ghl_assigned_agent_field_value"), // Custom field value (e.g., "Chris", "Rafi")
		requiredTag: text("required_tag"), // Tag pattern (e.g., "Owner: Chris")
		alowareUserId: text("aloware_user_id"), // Optional Aloware user ID
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		agentKeyUnique: uniqueIndex("agent_directory_agent_key_unique").on(table.agentKey),
		isActiveIdx: index("agent_directory_is_active_idx").on(table.isActive),
	}),
);

/**
 * Call List Registry Table
 * Tracks Aloware list IDs per agent/listKey combination
 */
export const callListRegistry = pgTable(
	"call_list_registry",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		agentKey: text("agent_key").notNull(),
		listKey: text("list_key").notNull(), // 'CALL_NOW' | 'NEW_LEADS' | 'FOLLOW_UP' | 'HOT'
		alowareListId: text("aloware_list_id"), // Aloware list ID
		alowareListName: text("aloware_list_name").notNull(), // e.g., 'DF_CHRIS_CALL_NOW'
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		agentListUnique: uniqueIndex("call_list_registry_agent_list_unique").on(
			table.agentKey,
			table.listKey,
		),
		alowareListNameUnique: uniqueIndex("call_list_registry_aloware_list_name_unique").on(
			table.alowareListName,
		),
		agentKeyIdx: index("call_list_registry_agent_key_idx").on(table.agentKey),
		listKeyIdx: index("call_list_registry_list_key_idx").on(table.listKey),
	}),
);

/**
 * Contact List Memberships Table
 * Tracks which contacts belong to which lists
 */
export const contactListMemberships = pgTable(
	"contact_list_memberships",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		contactId: text("contact_id").notNull(), // GHL contact ID
		agentKey: text("agent_key").notNull(),
		listKey: text("list_key").notNull(),
		status: text("status").notNull(), // 'active' | 'removed'
		reason: text("reason"), // Optional reason for status change
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		contactAgentListUnique: uniqueIndex("contact_list_memberships_contact_agent_list_unique").on(
			table.contactId,
			table.agentKey,
			table.listKey,
		),
		contactIdIdx: index("contact_list_memberships_contact_id_idx").on(table.contactId),
		agentListIdx: index("contact_list_memberships_agent_list_idx").on(
			table.agentKey,
			table.listKey,
		),
		statusIdx: index("contact_list_memberships_status_idx").on(table.status),
	}),
);

/**
 * Contact Agent State Table
 * Tracks last known agent assignment for reassignment detection
 */
export const contactAgentState = pgTable(
	"contact_agent_state",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		contactId: text("contact_id").notNull(), // GHL contact ID
		agentKey: text("agent_key").notNull(), // Last known agent key
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		contactIdUnique: uniqueIndex("contact_agent_state_contact_id_unique").on(table.contactId),
		agentKeyIdx: index("contact_agent_state_agent_key_idx").on(table.agentKey),
	}),
);


