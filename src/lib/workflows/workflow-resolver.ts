/**
 * Workflow Resolver
 * 
 * Resolves which workflow to use based on agent configuration.
 */

import { db } from "@/server/db";
import { elevenlabsAgentConfigs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { WorkflowType } from "./types";

/**
 * Get workflow type for an agent
 */
export async function getWorkflowTypeForAgent(agentId: string): Promise<WorkflowType | null> {
	const config = await db.query.elevenlabsAgentConfigs.findFirst({
		where: eq(elevenlabsAgentConfigs.agentId, agentId),
	});

	if (!config || !config.isActive) {
		return null;
	}

	return config.workflowType as WorkflowType;
}

/**
 * Get agent configuration
 */
export async function getAgentConfig(agentId: string) {
	return await db.query.elevenlabsAgentConfigs.findFirst({
		where: eq(elevenlabsAgentConfigs.agentId, agentId),
	});
}
