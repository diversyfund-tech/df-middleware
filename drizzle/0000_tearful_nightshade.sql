CREATE TABLE "contact_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aloware_contact_id" text NOT NULL,
	"ghl_contact_id" text NOT NULL,
	"phone_number" text,
	"email" text,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_direction" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"texting_message_id" text,
	"ghl_message_id" text,
	"aloware_message_id" text,
	"conversation_id" text,
	"ghl_contact_id" text,
	"aloware_contact_id" text,
	"from_number" text,
	"to_number" text,
	"direction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "optout_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"reason" text,
	"last_event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quarantine_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"event_source" text NOT NULL,
	"reason" text NOT NULL,
	"quarantined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quarantined_by" text
);
--> statement-breakpoint
CREATE TABLE "reconcile_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"totals" jsonb,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_id" text NOT NULL,
	"target_id" text,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_message" text,
	"correlation_id" text
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" text NOT NULL,
	"entity_type" text NOT NULL,
	"cursor_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cursor_id" text,
	"last_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "texting_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text DEFAULT 'message' NOT NULL,
	"entity_id" text,
	"conversation_id" text,
	"from_number" text,
	"to_number" text,
	"payload_json" jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contact_mappings_aloware_contact_id_unique" ON "contact_mappings" USING btree ("aloware_contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_mappings_ghl_contact_id_unique" ON "contact_mappings" USING btree ("ghl_contact_id");--> statement-breakpoint
CREATE INDEX "contact_mappings_phone_idx" ON "contact_mappings" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "contact_mappings_email_idx" ON "contact_mappings" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "message_mappings_texting_message_id_unique" ON "message_mappings" USING btree ("texting_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_mappings_ghl_message_id_unique" ON "message_mappings" USING btree ("ghl_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_mappings_aloware_message_id_unique" ON "message_mappings" USING btree ("aloware_message_id");--> statement-breakpoint
CREATE INDEX "message_mappings_conversation_id_idx" ON "message_mappings" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "message_mappings_ghl_contact_id_idx" ON "message_mappings" USING btree ("ghl_contact_id");--> statement-breakpoint
CREATE INDEX "message_mappings_aloware_contact_id_idx" ON "message_mappings" USING btree ("aloware_contact_id");--> statement-breakpoint
CREATE INDEX "message_mappings_from_number_idx" ON "message_mappings" USING btree ("from_number");--> statement-breakpoint
CREATE INDEX "message_mappings_to_number_idx" ON "message_mappings" USING btree ("to_number");--> statement-breakpoint
CREATE UNIQUE INDEX "optout_registry_phone_number_unique" ON "optout_registry" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "optout_registry_status_idx" ON "optout_registry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quarantine_events_event_id_idx" ON "quarantine_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "quarantine_events_event_source_idx" ON "quarantine_events" USING btree ("event_source");--> statement-breakpoint
CREATE INDEX "reconcile_runs_job_name_idx" ON "reconcile_runs" USING btree ("job_name");--> statement-breakpoint
CREATE INDEX "reconcile_runs_started_at_idx" ON "reconcile_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sync_log_entity_idx" ON "sync_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "sync_log_direction_idx" ON "sync_log" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "sync_log_started_at_idx" ON "sync_log" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sync_log_correlation_idx" ON "sync_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_state_direction_entity_unique" ON "sync_state" USING btree ("direction","entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "texting_webhook_events_dedupe_key_unique" ON "texting_webhook_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "texting_webhook_events_status_idx" ON "texting_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "texting_webhook_events_received_at_idx" ON "texting_webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "texting_webhook_events_entity_id_idx" ON "texting_webhook_events" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "texting_webhook_events_conversation_id_idx" ON "texting_webhook_events" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "texting_webhook_events_from_number_idx" ON "texting_webhook_events" USING btree ("from_number");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_dedupe_key_unique" ON "webhook_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_events_source_status_idx" ON "webhook_events" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "webhook_events_entity_idx" ON "webhook_events" USING btree ("entity_type","entity_id");