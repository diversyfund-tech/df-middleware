/**
 * Agent Configuration Schema and Types
 * 
 * Zod schemas and type definitions for ElevenLabs agent configurations.
 */

import { z } from "zod";

export const WorkflowTypeSchema = z.enum(["sales", "support", "appointment", "custom"]);

export const AgentConfigSchema = z.object({
	agentId: z.string().min(1), // ElevenLabs agent ID
	name: z.string().min(1),
	workflowType: WorkflowTypeSchema,
	systemPrompt: z.string().min(1),
	isActive: z.boolean().default(true),
	maxConcurrentCalls: z.number().int().positive().default(10),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: unknown): { valid: boolean; data?: AgentConfig; error?: string } {
	try {
		const data = AgentConfigSchema.parse(config);
		return { valid: true, data };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				valid: false,
				error: error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", "),
			};
		}
		return { valid: false, error: String(error) };
	}
}
