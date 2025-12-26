import { env } from "@/env";
import { db } from "@/server/db";
import { optoutRegistry } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { GHLContact } from "@/lib/ghl/types";

/**
 * Tag matching modes
 */
type TagMatchMode = "exact" | "case_insensitive" | "regex";

/**
 * Check if a tag matches a pattern based on TAG_MATCH_MODE
 */
function tagMatches(tag: string, pattern: string, mode: TagMatchMode): boolean {
	if (mode === "exact") {
		return tag === pattern;
	}
	if (mode === "case_insensitive") {
		return tag.toLowerCase() === pattern.toLowerCase();
	}
	if (mode === "regex") {
		try {
			const regex = new RegExp(pattern, "i");
			return regex.test(tag);
		} catch {
			// Invalid regex, fall back to case-insensitive
			return tag.toLowerCase() === pattern.toLowerCase();
		}
	}
	// Default to case-insensitive
	return tag.toLowerCase() === pattern.toLowerCase();
}

/**
 * Get all list keys from environment
 */
function getAllListKeys(): string[] {
	const listKeysStr = env.AGENT_LIST_KEYS || "CALL_NOW,NEW_LEADS,FOLLOW_UP,HOT";
	return listKeysStr.split(",").map((k) => k.trim()).filter(Boolean);
}

/**
 * Resolve list intent from event type and payload
 * Returns which lists to add and remove based on the event
 */
export async function resolveListKeysForEvent(
	eventType: string,
	payload: any,
	contact?: GHLContact
): Promise<{ add: string[]; remove: string[] }> {
	const tagMatchMode = (env.TAG_MATCH_MODE || "case_insensitive") as TagMatchMode;
	const allListKeys = getAllListKeys();

	// Check DNC/Opt-out status first
	if (contact?.phone) {
		const optout = await db.query.optoutRegistry.findFirst({
			where: eq(optoutRegistry.phoneNumber, contact.phone),
		});
		if (optout?.status === "opted_out") {
			// Remove from ALL lists and block re-add
			return {
				add: [],
				remove: allListKeys,
			};
		}
	}

	const add: string[] = [];
	const remove: string[] = [];

	// Tag Added events
	if (eventType === "tag.added" || eventType === "contact.tag.added") {
		const tagName = payload.tagName || payload.tag || payload.name || "";
		if (tagName) {
			// Map tags to list keys (case-insensitive matching)
			if (tagMatches(tagName, "CALL_NOW", tagMatchMode)) {
				add.push("CALL_NOW");
			}
			if (tagMatches(tagName, "HOT", tagMatchMode)) {
				add.push("HOT");
			}
			if (tagMatches(tagName, "FOLLOW_UP", tagMatchMode)) {
				add.push("FOLLOW_UP");
			}
		}
	}

	// Tag Removed events
	if (eventType === "tag.removed" || eventType === "contact.tag.removed") {
		const tagName = payload.tagName || payload.tag || payload.name || "";
		if (tagName) {
			if (tagMatches(tagName, "CALL_NOW", tagMatchMode)) {
				remove.push("CALL_NOW");
			}
			if (tagMatches(tagName, "HOT", tagMatchMode)) {
				remove.push("HOT");
			}
			if (tagMatches(tagName, "FOLLOW_UP", tagMatchMode)) {
				remove.push("FOLLOW_UP");
			}
		}
	}

	// Contact Created events
	if (eventType === "contact.created") {
		// Default add NEW_LEADS
		// Important: Contacts without resolved agent are routed to DF_UNASSIGNED_NEW_LEADS (ensures no silent drops)
		add.push("NEW_LEADS");
	}

	// Pipeline Stage Changed events
	if (eventType === "opportunity.statusChanged" || eventType === "pipeline.stageChanged") {
		const stage = payload.pipelineStage || payload.stage || payload.status || "";
		const stageLower = String(stage).toLowerCase();

		if (stageLower.includes("new lead") || stageLower === "new") {
			add.push("NEW_LEADS");
		}
		if (stageLower.includes("follow up") || stageLower === "followup") {
			add.push("FOLLOW_UP");
		}
		if (stageLower.includes("hot")) {
			add.push("HOT");
		}
		if (stageLower.includes("closed") || stageLower.includes("dead") || stageLower === "won" || stageLower === "lost") {
			// Remove from ALL lists
			remove.push(...allListKeys);
		}
	}

	// Contact Changed events - check current tags to determine list intent
	if (eventType === "contact.changed" || eventType === "contact.updated") {
		if (contact?.tags && Array.isArray(contact.tags)) {
			// Check if contact has tags that map to lists
			for (const tag of contact.tags) {
				if (typeof tag !== "string") continue;
				if (tagMatches(tag, "CALL_NOW", tagMatchMode)) {
					if (!add.includes("CALL_NOW")) add.push("CALL_NOW");
				}
				if (tagMatches(tag, "HOT", tagMatchMode)) {
					if (!add.includes("HOT")) add.push("HOT");
				}
				if (tagMatches(tag, "FOLLOW_UP", tagMatchMode)) {
					if (!add.includes("FOLLOW_UP")) add.push("FOLLOW_UP");
				}
			}
		}
	}

	return { add, remove };
}

