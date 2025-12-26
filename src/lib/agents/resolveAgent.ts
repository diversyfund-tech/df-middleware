import { db } from "@/server/db";
import { agentDirectory } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@/env";
import type { GHLContact } from "@/lib/ghl/types";

/**
 * Resolve agent assignment for a GHL contact
 * Priority order:
 * 1. Contact owner (id or email) matches agentDirectory.ghlOwnerId/ghlOwnerEmail
 * 2. Custom field assignedAgent matches agentDirectory.ghlAssignedAgentFieldValue
 * 3. Tags contain agentDirectory.requiredTag (e.g., "Owner: Chris")
 * 4. Default to DEFAULT_AGENT_KEY ("UNASSIGNED")
 */
export async function resolveAgentForGhlContact(
	contact: GHLContact
): Promise<{ agentKey: string; reason: string }> {
	const defaultAgentKey = env.DEFAULT_AGENT_KEY || "UNASSIGNED";

	try {
		// Get all active agents from directory
		const agents = await db.query.agentDirectory.findMany({
			where: eq(agentDirectory.isActive, true),
		});

		// Priority 1: Check contact owner (id or email)
		if (contact.owner) {
			let ownerId: string | undefined;
			let ownerEmail: string | undefined;

			if (typeof contact.owner === "string") {
				ownerId = contact.owner;
			} else if (typeof contact.owner === "object" && contact.owner !== null) {
				ownerId = (contact.owner as { id?: string }).id;
				ownerEmail = (contact.owner as { email?: string }).email;
			}

			for (const agent of agents) {
				if (ownerId && agent.ghlOwnerId && ownerId === agent.ghlOwnerId) {
					return {
						agentKey: agent.agentKey,
						reason: `owner_id_match:${ownerId}`,
					};
				}
				if (ownerEmail && agent.ghlOwnerEmail && ownerEmail.toLowerCase() === agent.ghlOwnerEmail.toLowerCase()) {
					return {
						agentKey: agent.agentKey,
						reason: `owner_email_match:${ownerEmail}`,
					};
				}
			}
		}

		// Priority 2: Check custom field assignedAgent
		const assignedAgentFieldKey = env.GHL_ASSIGNED_AGENT_FIELD_KEY || "assignedAgent";
		const assignedAgentValue = contact.customFields?.[assignedAgentFieldKey];
		if (assignedAgentValue && typeof assignedAgentValue === "string") {
			for (const agent of agents) {
				if (
					agent.ghlAssignedAgentFieldValue &&
					assignedAgentValue.toLowerCase() === agent.ghlAssignedAgentFieldValue.toLowerCase()
				) {
					return {
						agentKey: agent.agentKey,
						reason: `custom_field_match:${assignedAgentFieldKey}=${assignedAgentValue}`,
					};
				}
			}
		}

		// Priority 3: Check tags for requiredTag
		if (contact.tags && Array.isArray(contact.tags)) {
			for (const agent of agents) {
				if (agent.requiredTag) {
					const tagMatch = contact.tags.some((tag) => {
						if (typeof tag !== "string") return false;
						return tag === agent.requiredTag || tag.toLowerCase() === agent.requiredTag?.toLowerCase();
					});
					if (tagMatch) {
						return {
							agentKey: agent.agentKey,
							reason: `tag_match:${agent.requiredTag}`,
						};
					}
				}
			}
		}

		// Priority 4: Default to UNASSIGNED
		return {
			agentKey: defaultAgentKey,
			reason: "default_unassigned",
		};
	} catch (error) {
		console.error("[resolveAgent] Error resolving agent:", error);
		// On error, default to UNASSIGNED
		return {
			agentKey: defaultAgentKey,
			reason: `error:${error instanceof Error ? error.message : "unknown"}`,
		};
	}
}

