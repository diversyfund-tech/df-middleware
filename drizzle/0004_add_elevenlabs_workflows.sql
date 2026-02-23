-- Add ElevenLabs workflow system tables

-- ElevenLabs Agent Configs Table
CREATE TABLE IF NOT EXISTS "elevenlabs_agent_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"name" text NOT NULL,
	"workflow_type" text NOT NULL,
	"system_prompt" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_concurrent_calls" integer DEFAULT 10,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create unique index on agent_id
CREATE UNIQUE INDEX IF NOT EXISTS "elevenlabs_agent_configs_agent_id_unique" ON "elevenlabs_agent_configs" ("agent_id");

-- Create indexes for workflow_type and is_active
CREATE INDEX IF NOT EXISTS "elevenlabs_agent_configs_workflow_type_idx" ON "elevenlabs_agent_configs" ("workflow_type");
CREATE INDEX IF NOT EXISTS "elevenlabs_agent_configs_is_active_idx" ON "elevenlabs_agent_configs" ("is_active");

-- Workflow Executions Table
CREATE TABLE IF NOT EXISTS "workflow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"workflow_type" text NOT NULL,
	"status" text NOT NULL,
	"workflow_state" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"metadata" jsonb
);

-- Create indexes for workflow_executions
CREATE INDEX IF NOT EXISTS "workflow_executions_agent_id_idx" ON "workflow_executions" ("agent_id");
CREATE INDEX IF NOT EXISTS "workflow_executions_status_idx" ON "workflow_executions" ("status");
CREATE INDEX IF NOT EXISTS "workflow_executions_started_at_idx" ON "workflow_executions" ("started_at");

-- Workflow Steps Table
CREATE TABLE IF NOT EXISTS "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"step_type" text NOT NULL,
	"step_name" text NOT NULL,
	"status" text NOT NULL,
	"tool_called" text,
	"tool_args" jsonb,
	"result" jsonb,
	"error_message" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create foreign key constraint
DO $$ BEGIN
 ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_execution_id_workflow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for workflow_steps
CREATE INDEX IF NOT EXISTS "workflow_steps_execution_id_idx" ON "workflow_steps" ("execution_id");
CREATE INDEX IF NOT EXISTS "workflow_steps_status_idx" ON "workflow_steps" ("status");
CREATE INDEX IF NOT EXISTS "workflow_steps_timestamp_idx" ON "workflow_steps" ("timestamp");
