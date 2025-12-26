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
		TEXTING_SYNC_TO_ALOWARE: z.string().optional(),
		// Admin Configuration
		DF_ADMIN_SECRET: z.string().min(1),
		// Conflict Resolution Configuration
		CONTACT_SOURCE_OF_TRUTH: z.enum(["ghl", "aloware", "merge"]).optional().default("merge"),
		// Alerting Configuration
		ALERT_WEBHOOK_URL: z.union([z.string().url(), z.literal("")]).optional(),
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
		ALOWARE_API_TOKEN: process.env.ALOWARE_API_TOKEN,
		ALOWARE_WEBHOOK_BASIC_USER: process.env.ALOWARE_WEBHOOK_BASIC_USER,
		ALOWARE_WEBHOOK_BASIC_PASS: process.env.ALOWARE_WEBHOOK_BASIC_PASS,
		ALOWARE_WEBHOOK_ALLOWED_EVENTS: process.env.ALOWARE_WEBHOOK_ALLOWED_EVENTS,
		X_DF_JOBS_SECRET: process.env.X_DF_JOBS_SECRET,
		JOBS_BATCH_SIZE: process.env.JOBS_BATCH_SIZE,
		VERITY_BASE_URL: process.env.VERITY_BASE_URL,
		VERITY_API_KEY: process.env.VERITY_API_KEY,
		VERITY_WEBHOOK_SECRET: process.env.VERITY_WEBHOOK_SECRET,
		TEXTING_SYNC_TO_ALOWARE: process.env.TEXTING_SYNC_TO_ALOWARE,
		DF_ADMIN_SECRET: process.env.DF_ADMIN_SECRET,
		CONTACT_SOURCE_OF_TRUTH: process.env.CONTACT_SOURCE_OF_TRUTH,
		ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
	},
	skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});


