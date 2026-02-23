-- Add Workflow Definitions table for storing user-created workflows

CREATE TABLE IF NOT EXISTS "workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"workflow_type" text NOT NULL,
	"description" text,
	"steps" jsonb NOT NULL,
	"initial_step" text NOT NULL,
	"created_by" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "workflow_definitions_workflow_type_idx" ON "workflow_definitions" ("workflow_type");
CREATE INDEX IF NOT EXISTS "workflow_definitions_is_active_idx" ON "workflow_definitions" ("is_active");
