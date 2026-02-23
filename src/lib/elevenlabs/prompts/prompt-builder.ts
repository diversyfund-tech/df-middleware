/**
 * Prompt Builder
 * 
 * Builds system prompts dynamically for ElevenLabs agents.
 */

import { BASE_PROMPT_TEMPLATE } from "./base-prompt";
import { SALES_AGENT_PROMPT_TEMPLATE } from "./sales-agent-prompt";
import { getToolDescriptionsForPrompt } from "@/lib/mcp/tool-registry";
import { getWorkflowToolInstructions } from "@/lib/mcp/workflow-tools";
import type { WorkflowType } from "@/lib/workflows/types";

export interface PromptBuilderOptions {
	workflowType: WorkflowType;
	agentName?: string;
	includeTools?: boolean;
	customInstructions?: string;
}

/**
 * Build system prompt for ElevenLabs agent
 */
export async function buildSystemPrompt(options: PromptBuilderOptions): Promise<string> {
	const { workflowType, agentName, includeTools = true, customInstructions } = options;

	let prompt = "";

	// Add base prompt
	prompt += BASE_PROMPT_TEMPLATE;
	prompt += "\n\n";

	// Add workflow-specific prompt
	if (workflowType === "sales") {
		prompt += SALES_AGENT_PROMPT_TEMPLATE;
	} else if (workflowType === "support") {
		prompt += `You are a support agent. Your role is to help customers with their questions and issues.
Use available tools to look up information, create support tickets, and send responses.`;
	} else if (workflowType === "appointment") {
		prompt += `You are an appointment booking agent. Your role is to:
1. Collect contact information
2. Check calendar availability
3. Book appointments
4. Send confirmation messages`;
	} else {
		prompt += `You are a custom workflow agent. Follow the workflow steps as defined.`;
	}

	prompt += "\n\n";

	// Add agent name if provided
	if (agentName) {
		prompt += `Agent Name: ${agentName}\n\n`;
	}

	// Add tool descriptions if requested
	if (includeTools) {
		prompt += "## Available Tools\n\n";
		prompt += getWorkflowToolInstructions(workflowType);
		prompt += "\n\n";

		try {
			const toolDescriptions = await getToolDescriptionsForPrompt(workflowType);
			prompt += "### Tool Details\n\n";
			prompt += toolDescriptions;
			prompt += "\n\n";
		} catch (error) {
			console.error("[prompt-builder] Error loading tool descriptions:", error);
			prompt += "Note: Tool descriptions could not be loaded.\n\n";
		}
	}

	// Add custom instructions if provided
	if (customInstructions) {
		prompt += "## Custom Instructions\n\n";
		prompt += customInstructions;
		prompt += "\n\n";
	}

	return prompt;
}

/**
 * Build prompt from agent configuration
 */
export async function buildPromptFromAgentConfig(
	agentId: string,
	systemPrompt?: string
): Promise<string> {
	// If custom system prompt is provided, use it
	if (systemPrompt) {
		return systemPrompt;
	}

	// Otherwise, build from workflow type
	// This will be enhanced when we load agent config
	return BASE_PROMPT_TEMPLATE;
}
