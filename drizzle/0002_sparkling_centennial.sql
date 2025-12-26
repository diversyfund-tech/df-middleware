CREATE TABLE "agent_directory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_key" text NOT NULL,
	"display_name" text NOT NULL,
	"ghl_owner_id" text,
	"ghl_owner_email" text,
	"ghl_assigned_agent_field_value" text,
	"required_tag" text,
	"aloware_user_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_list_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_key" text NOT NULL,
	"list_key" text NOT NULL,
	"aloware_list_id" text,
	"aloware_list_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_agent_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" text NOT NULL,
	"agent_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_list_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" text NOT NULL,
	"agent_key" text NOT NULL,
	"list_key" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_directory_agent_key_unique" ON "agent_directory" USING btree ("agent_key");--> statement-breakpoint
CREATE INDEX "agent_directory_is_active_idx" ON "agent_directory" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "call_list_registry_agent_list_unique" ON "call_list_registry" USING btree ("agent_key","list_key");--> statement-breakpoint
CREATE UNIQUE INDEX "call_list_registry_aloware_list_name_unique" ON "call_list_registry" USING btree ("aloware_list_name");--> statement-breakpoint
CREATE INDEX "call_list_registry_agent_key_idx" ON "call_list_registry" USING btree ("agent_key");--> statement-breakpoint
CREATE INDEX "call_list_registry_list_key_idx" ON "call_list_registry" USING btree ("list_key");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_agent_state_contact_id_unique" ON "contact_agent_state" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_agent_state_agent_key_idx" ON "contact_agent_state" USING btree ("agent_key");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_list_memberships_contact_agent_list_unique" ON "contact_list_memberships" USING btree ("contact_id","agent_key","list_key");--> statement-breakpoint
CREATE INDEX "contact_list_memberships_contact_id_idx" ON "contact_list_memberships" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_list_memberships_agent_list_idx" ON "contact_list_memberships" USING btree ("agent_key","list_key");--> statement-breakpoint
CREATE INDEX "contact_list_memberships_status_idx" ON "contact_list_memberships" USING btree ("status");