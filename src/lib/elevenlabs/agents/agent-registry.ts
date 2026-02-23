/**
 * Agent Registry
 * 
 * CRUD operations for ElevenLabs agent configurations.
 */

import { db } from "@/server/db";
import { elevenlabsAgentConfigs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { AgentConfig } from "./agent-config";

/**
 * Create a new agent configuration
 */
export async function createAgentConfig(config: AgentConfig): Promise<string> {
	const [agent] = await db
		.insert(elevenlabsAgentConfigs)
		.values({
			agentId: config.agentId,
			name: config.name,
			workflowType: config.workflowType,
			systemPrompt: config.systemPrompt,
			isActive: config.isActive,
			maxConcurrentCalls: config.maxConcurrentCalls,
		})
		.returning({ id: elevenlabsAgentConfigs.id });

	if (!agent) {
		throw new Error("Failed to create agent configuration");
	}

	return agent.id;
}

/**
 * Get agent configuration by ElevenLabs agent ID
 */
export async function getAgentConfigByAgentId(agentId: string) {
	return await db.query.elevenlabsAgentConfigs.findFirst({
		where: eq(elevenlabsAgentConfigs.agentId, agentId),
	});
}

/**
 * Get agent configuration by database ID
 */
export async function getAgentConfigById(id: string) {
	return await db.query.elevenlabsAgentConfigs.findFirst({
		where: eq(elevenlabsAgentConfigs.id, id),
	});
}

/**
 * List all agent configurations
 */
export async function listAgentConfigs(options?: {
	activeOnly?: boolean;
}) {
	if (options?.activeOnly) {
		return await db.query.elevenlabsAgentConfigs.findMany({
			where: eq(elevenlabsAgentConfigs.isActive, true),
		});
	}

	return await db.query.elevenlabsAgentConfigs.findMany();
}

/**
 * Update agent configuration
 */
export async function updateAgentConfig(
	agentId: string,
	updates: Partial<Omit<AgentConfig, "agentId">>
): Promise<void> {
	await db
		.update(elevenlabsAgentConfigs)
		.set({
			...updates,
			updatedAt: new Date(),
		})
		.where(eq(elevenlabsAgentConfigs.agentId, agentId));
}

/**
 * Delete agent configuration
 */
export async function deleteAgentConfig(agentId: string): Promise<void> {
	await db
		.delete(elevenlabsAgentConfigs)
		.where(eq(elevenlabsAgentConfigs.agentId, agentId));
}

/**
 * Check if agent is active
 */
export async function isAgentActive(agentId: string): Promise<boolean> {
	const config = await getAgentConfigByAgentId(agentId);
	return config?.isActive === true;
}
