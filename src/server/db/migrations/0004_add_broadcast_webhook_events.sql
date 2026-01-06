-- Add broadcast_webhook_events table for storing broadcast analytics sync events from Verity

CREATE TABLE IF NOT EXISTS "broadcast_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"broadcast_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_webhook_events_dedupe_key_unique" ON "broadcast_webhook_events" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "broadcast_webhook_events_status_idx" ON "broadcast_webhook_events" ("status");
CREATE INDEX IF NOT EXISTS "broadcast_webhook_events_broadcast_id_idx" ON "broadcast_webhook_events" ("broadcast_id");
CREATE INDEX IF NOT EXISTS "broadcast_webhook_events_received_at_idx" ON "broadcast_webhook_events" ("received_at");


