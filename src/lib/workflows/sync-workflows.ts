/**
 * Sync Workflows Registry
 * 
 * Central registry for all sync workflow definitions.
 */

import { getContactSyncWorkflow } from "./contact-sync-workflow";
import { getCallSyncWorkflow } from "./call-sync-workflow";
import { getMessageSyncWorkflow } from "./message-sync-workflow";
import { getListSyncWorkflow } from "./list-sync-workflow";
import type { WorkflowDefinition } from "./types";

/**
 * Get sync workflow by type and direction
 */
export function getSyncWorkflow(
	type: "contact" | "call" | "message" | "list" | "dnc",
	direction?: "aloware_to_ghl" | "ghl_to_aloware" | "texting_to_ghl" | "texting_to_aloware"
): WorkflowDefinition {
	switch (type) {
		case "contact":
			if (!direction || direction === "aloware_to_ghl" || direction === "ghl_to_aloware") {
				return getContactSyncWorkflow(direction || "aloware_to_ghl");
			}
			throw new Error(`Invalid direction for contact sync: ${direction}`);
		
		case "call":
			return getCallSyncWorkflow();
		
		case "message":
			if (direction === "texting_to_ghl") {
				return getMessageSyncWorkflow("ghl");
			} else if (direction === "texting_to_aloware") {
				return getMessageSyncWorkflow("aloware");
			}
			throw new Error(`Invalid direction for message sync: ${direction}`);
		
		case "list":
			return getListSyncWorkflow();
		
		case "dnc":
			// DNC sync workflow would go here
			throw new Error("DNC sync workflow not yet implemented");
		
		default:
			throw new Error(`Unknown sync workflow type: ${type}`);
	}
}

/**
 * List all available sync workflows
 */
export function listSyncWorkflows(): Array<{ type: string; direction?: string; name: string }> {
	return [
		{ type: "contact", direction: "aloware_to_ghl", name: "Contact Sync (Aloware → GHL)" },
		{ type: "contact", direction: "ghl_to_aloware", name: "Contact Sync (GHL → Aloware)" },
		{ type: "call", name: "Call Sync (Aloware → GHL)" },
		{ type: "message", direction: "texting_to_ghl", name: "Message Sync (Texting → GHL)" },
		{ type: "message", direction: "texting_to_aloware", name: "Message Sync (Texting → Aloware)" },
		{ type: "list", name: "List Sync (GHL Tag → Aloware List)" },
	];
}
