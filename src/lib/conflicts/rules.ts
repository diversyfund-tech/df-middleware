import { env } from "@/env";

/**
 * Canonical contact model for conflict resolution
 */
export interface CanonicalContact {
	firstName?: string;
	lastName?: string;
	email?: string;
	phone?: string; // E.164
	tags?: string[];
	timezone?: string;
	address?: {
		country?: string;
		state?: string;
		city?: string;
	};
	custom?: Record<string, unknown>;
	updatedAt?: string; // ISO
	source?: "ghl" | "aloware";
}

/**
 * Source of truth configuration
 */
export const CONTACT_SOURCE_OF_TRUTH = (env.CONTACT_SOURCE_OF_TRUTH || "merge") as "ghl" | "aloware" | "merge";

