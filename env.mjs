import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BASE_URL: z.string().url().optional(),
		NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
		// GHL Configuration
		GHL_API_KEY: z.string().min(1),
		GHL_LOCATION_ID: z.string().min(1),
		GHL_CALENDAR_ID: z.string().min(1),
		GHL_BASE_URL: z.string().url().default("https://services.leadconnectorhq.com").optional(),
		GHL_WEBHOOK_SECRET: z.string().optional(),
		GHL_CONVERSATION_PROVIDER_ID: z.string().optional(), // Required for importing historical messages
		// GHL OAuth Configuration (for Marketplace App)
		GHL_CLIENT_ID: z.string().optional(),
		GHL_CLIENT_SECRET: z.string().optional(),
		// Aloware Configuration
		ALOWARE_API_TOKEN: z.string().min(1),
		ALOWARE_WEBHOOK_BASIC_USER: z.string().min(1),
		ALOWARE_WEBHOOK_BASIC_PASS: z.string().min(1),
		ALOWARE_WEBHOOK_ALLOWED_EVENTS: z.string().optional(),
		// Job Processing Configuration
		X_DF_JOBS_SECRET: z.string().min(1),
		JOBS_BATCH_SIZE: z.string().optional(),
		// Texting System Configuration (Verity Integration)
		// Verity is the proprietary texting system that handles Telnyx integration
		VERITY_BASE_URL: z.string().url().optional(),
		VERITY_API_KEY: z.string().optional(),
		VERITY_WEBHOOK_SECRET: z.string().optional(),
		VERITY_DATABASE_URL: z.string().url().optional(), // Verity's Neon database connection
		TEXTING_SYNC_TO_ALOWARE: z.string().optional(),
		// Admin Configuration
		DF_ADMIN_SECRET: z.string().min(1),
		// Conflict Resolution Configuration
		CONTACT_SOURCE_OF_TRUTH: z.preprocess(
			(val) => {
				const trimmed = typeof val === "string" ? val.trim() : "";
				if (!trimmed || trimmed === "") return "merge";
				if (["ghl", "aloware", "merge"].includes(trimmed)) return trimmed;
				return "merge"; // default for invalid values
			},
			z.enum(["ghl", "aloware", "merge"]).default("merge")
		).optional(),
		// Alerting Configuration
		ALERT_WEBHOOK_URL: z.preprocess(
			(val) => {
				const trimmed = typeof val === "string" ? val.trim() : "";
				if (!trimmed || trimmed === "") return undefined;
				try {
					new URL(trimmed);
					return trimmed;
				} catch {
					return undefined; // invalid URL becomes undefined
				}
			},
			z.string().url().optional()
		).optional(),
		// Agent-Managed Call Lists Configuration
		AGENT_LIST_KEYS: z.string().default("CALL_NOW,NEW_LEADS,FOLLOW_UP,HOT"),
		DEFAULT_AGENT_KEY: z.string().default("UNASSIGNED"),
		GHL_ASSIGNED_AGENT_FIELD_KEY: z.string().default("assignedAgent"),
		ENABLE_AGENT_LIST_SYNC: z.string().default("true"),
		TAG_MATCH_MODE: z.preprocess(
			(val) => {
				if (!val || val === "") return "case_insensitive";
				if (["exact", "case_insensitive", "regex"].includes(String(val))) return String(val);
				return "case_insensitive";
			},
			z.enum(["exact", "case_insensitive", "regex"]).default("case_insensitive")
		),
		// Aloware Sequence Configuration
		ALOWARE_STATUS_TO_SEQUENCE: z.preprocess(
			(val) => {
				if (!val || val === "") return "{}";
				try {
					// Validate it's valid JSON
					JSON.parse(String(val));
					return String(val);
				} catch {
					return "{}";
				}
			},
			z.string().default("{}")
		),
		// Feature Flags
		ENABLE_ALOWARE_SEQUENCES: z.string().default("false"), // Disable sequences temporarily
		ENABLE_POWER_DIALER_LISTS: z.string().default("false"), // Disable power dialer lists temporarily
		// MCP Server & API Gateway Configuration
		PORT: z.string().default("3001").optional(),
		DF_MIDDLEWARE_API_KEY: z.string().optional(), // API key for middleware-to-middleware communication
		CLERK_SECRET_KEY: z.string().min(1), // Clerk secret key for JWT verification (required for MCP server)
		VERITY_CATALOG_PATH: z.string().optional(), // Path to Verity API catalog JSON file
		CORS_ALLOWED_ORIGINS: z.string().optional(), // Comma-separated list of allowed CORS origins
		// ElevenLabs Workflow Configuration
		ELEVENLABS_WEBHOOK_SECRET: z.string().optional(), // Secret for ElevenLabs webhook verification
		MCP_BASE_URL: z.string().url().default("http://localhost:3002").optional(), // Not used (direct calls), but for future
	},
	client: {},
	runtimeEnv: {
		DATABASE_URL: process.env.DATABASE_URL,
		BASE_URL: process.env.BASE_URL,
		NODE_ENV: process.env.NODE_ENV,
		GHL_API_KEY: process.env.GHL_API_KEY,
		GHL_LOCATION_ID: process.env.GHL_LOCATION_ID,
		GHL_CALENDAR_ID: process.env.GHL_CALENDAR_ID,
		GHL_BASE_URL: process.env.GHL_BASE_URL,
		GHL_WEBHOOK_SECRET: process.env.GHL_WEBHOOK_SECRET,
		GHL_CONVERSATION_PROVIDER_ID: process.env.GHL_CONVERSATION_PROVIDER_ID,
		GHL_CLIENT_ID: process.env.GHL_CLIENT_ID,
		GHL_CLIENT_SECRET: process.env.GHL_CLIENT_SECRET,
		ALOWARE_API_TOKEN: process.env.ALOWARE_API_TOKEN,
		ALOWARE_WEBHOOK_BASIC_USER: process.env.ALOWARE_WEBHOOK_BASIC_USER,
		ALOWARE_WEBHOOK_BASIC_PASS: process.env.ALOWARE_WEBHOOK_BASIC_PASS,
		ALOWARE_WEBHOOK_ALLOWED_EVENTS: process.env.ALOWARE_WEBHOOK_ALLOWED_EVENTS,
		X_DF_JOBS_SECRET: process.env.X_DF_JOBS_SECRET,
		JOBS_BATCH_SIZE: process.env.JOBS_BATCH_SIZE,
		VERITY_BASE_URL: process.env.VERITY_BASE_URL,
		VERITY_API_KEY: process.env.VERITY_API_KEY,
		VERITY_WEBHOOK_SECRET: process.env.VERITY_WEBHOOK_SECRET,
		VERITY_DATABASE_URL: process.env.VERITY_DATABASE_URL,
		TEXTING_SYNC_TO_ALOWARE: process.env.TEXTING_SYNC_TO_ALOWARE,
		DF_ADMIN_SECRET: process.env.DF_ADMIN_SECRET,
		CONTACT_SOURCE_OF_TRUTH: process.env.CONTACT_SOURCE_OF_TRUTH,
		ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
		AGENT_LIST_KEYS: process.env.AGENT_LIST_KEYS,
		DEFAULT_AGENT_KEY: process.env.DEFAULT_AGENT_KEY,
		GHL_ASSIGNED_AGENT_FIELD_KEY: process.env.GHL_ASSIGNED_AGENT_FIELD_KEY,
		ENABLE_AGENT_LIST_SYNC: process.env.ENABLE_AGENT_LIST_SYNC,
		TAG_MATCH_MODE: process.env.TAG_MATCH_MODE,
		ALOWARE_STATUS_TO_SEQUENCE: process.env.ALOWARE_STATUS_TO_SEQUENCE,
		ENABLE_ALOWARE_SEQUENCES: process.env.ENABLE_ALOWARE_SEQUENCES,
		ENABLE_POWER_DIALER_LISTS: process.env.ENABLE_POWER_DIALER_LISTS,
		PORT: process.env.PORT,
		DF_MIDDLEWARE_API_KEY: process.env.DF_MIDDLEWARE_API_KEY,
		CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
		VERITY_CATALOG_PATH: process.env.VERITY_CATALOG_PATH,
		ELEVENLABS_WEBHOOK_SECRET: process.env.ELEVENLABS_WEBHOOK_SECRET,
		MCP_BASE_URL: process.env.MCP_BASE_URL,
		CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
	},
	skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});


