declare module "@/env" {
	export const env: {
		DATABASE_URL: string;
		BASE_URL?: string;
		NODE_ENV: "development" | "production" | "test";
		// GHL Configuration
		GHL_API_KEY: string;
		GHL_LOCATION_ID: string;
		GHL_CALENDAR_ID: string;
		GHL_BASE_URL?: string;
		GHL_WEBHOOK_SECRET?: string;
		// Aloware Configuration
		ALOWARE_API_TOKEN: string;
		ALOWARE_WEBHOOK_BASIC_USER: string;
		ALOWARE_WEBHOOK_BASIC_PASS: string;
		ALOWARE_WEBHOOK_ALLOWED_EVENTS?: string;
		// Job Processing Configuration
		X_DF_JOBS_SECRET: string;
		JOBS_BATCH_SIZE?: string;
		// Texting System Configuration (Verity Integration)
		VERITY_BASE_URL?: string;
		VERITY_API_KEY?: string;
		VERITY_WEBHOOK_SECRET?: string;
		TEXTING_SYNC_TO_ALOWARE?: string;
		// Admin Configuration
		DF_ADMIN_SECRET: string;
		// Conflict Resolution Configuration
		CONTACT_SOURCE_OF_TRUTH: "ghl" | "aloware" | "merge";
		// Alerting Configuration
		ALERT_WEBHOOK_URL?: string;
		// Agent-Managed Call Lists Configuration
		AGENT_LIST_KEYS: string;
		DEFAULT_AGENT_KEY: string;
		GHL_ASSIGNED_AGENT_FIELD_KEY: string;
		ENABLE_AGENT_LIST_SYNC: string;
		TAG_MATCH_MODE: "exact" | "case_insensitive" | "regex";
	};
}


