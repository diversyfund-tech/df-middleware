/**
 * AI Workflow Assistant
 * 
 * AI assistant logic for helping users design workflows through conversation.
 */

import OpenAI from "openai";
import type { WorkflowDefinition } from "./types";
import { validateWorkflow } from "./workflow-validator";
import { getWorkflowBuilderSystemPrompt, getWorkflowBuilderUserPrompt } from "./prompt-templates";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export interface WorkflowBuilderResponse {
	message: string;
	workflow?: WorkflowDefinition;
	questions?: string[];
	needsClarification: boolean;
}

/**
 * Process user message and generate workflow design response
 */
export async function processWorkflowBuilderMessage(
	messages: Array<{ role: "user" | "assistant"; content: string }>,
	workflowType?: string
): Promise<WorkflowBuilderResponse> {
	const systemPrompt = await getWorkflowBuilderSystemPrompt();
	const lastMessage = messages[messages.length - 1]?.content || "";

	// Get available tools for the workflow type (server-side only)
	let toolsContext = "";
	if (typeof window === "undefined") {
		try {
			const { getToolsForWorkflow } = await import("@/lib/mcp/tool-registry");
			const availableTools = workflowType
				? await getToolsForWorkflow(workflowType)
				: await getToolsForWorkflow("custom");

			toolsContext = availableTools
				.slice(0, 50) // Limit to avoid token limits
				.map((tool) => `- ${tool.name}: ${tool.description}`)
				.join("\n");
		} catch (error) {
			console.warn("[ai-assistant] Could not load tools:", error);
		}
	}

	const enhancedSystemPrompt = toolsContext
		? `${systemPrompt}

## Available Tools for This Workflow

${toolsContext}

Remember to only suggest tools that are listed above.`
		: systemPrompt;

	try {
		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: enhancedSystemPrompt },
				...messages.map((m) => ({
					role: m.role as "user" | "assistant",
					content: m.content,
				})),
			],
			temperature: 0.7,
			max_tokens: 2000,
		});

		const aiMessage = response.choices[0]?.message?.content || "";
		
		// Try to extract workflow definition from response
		const workflow = extractWorkflowFromResponse(aiMessage);

		// If workflow found, validate it
		if (workflow) {
			const validation = await validateWorkflow(workflow);
			if (!validation.valid) {
				return {
					message: aiMessage,
					needsClarification: true,
					questions: [
						"I found a workflow definition, but there are some issues:",
						...validation.errors.map((e) => `- ${e.message}`),
						"Would you like me to fix these issues?",
					],
					workflow: workflow, // Still return workflow even with validation errors so user can see it
				};
			}
			
			// Workflow is valid - include it in response
			return {
				message: aiMessage,
				workflow: workflow,
				needsClarification: false,
			};
		}

		// Check if AI is asking questions
		const needsClarification = aiMessage.toLowerCase().includes("?");

		return {
			message: aiMessage,
			workflow: undefined,
			needsClarification,
		};
	} catch (error: any) {
		console.error("[ai-assistant] Error:", error);
		return {
			message: `I encountered an error: ${error.message || "Unknown error"}. Please try again.`,
			needsClarification: true,
		};
	}
}

/**
 * Extract workflow definition from AI response
 * Looks for JSON code blocks or structured workflow data
 */
function extractWorkflowFromResponse(response: string): WorkflowDefinition | null {
	// Try to find JSON code block
	const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			if (isWorkflowDefinition(parsed)) {
				return parsed;
			}
		} catch (e) {
			// Not valid JSON
		}
	}

	// Try to find JSON without code block markers
	const jsonPattern = /\{[\s\S]*"type"[\s\S]*"steps"[\s\S]*\}/;
	const match = response.match(jsonPattern);
	if (match) {
		try {
			const parsed = JSON.parse(match[0]);
			if (isWorkflowDefinition(parsed)) {
				return parsed;
			}
		} catch (e) {
			// Not valid JSON
		}
	}

	return null;
}

/**
 * Type guard to check if object is a WorkflowDefinition
 */
function isWorkflowDefinition(obj: unknown): obj is WorkflowDefinition {
	if (!obj || typeof obj !== "object") return false;
	const wf = obj as Record<string, unknown>;
	return (
		typeof wf.type === "string" &&
		typeof wf.name === "string" &&
		typeof wf.description === "string" &&
		typeof wf.initialStep === "string" &&
		Array.isArray(wf.steps) &&
		wf.steps.length > 0
	);
}

/**
 * Suggest workflow improvements
 */
export async function suggestWorkflowImprovements(
	workflow: WorkflowDefinition
): Promise<string[]> {
	const suggestions: string[] = [];

	// Check for common issues
	if (workflow.steps.length < 2) {
		suggestions.push("Consider adding more steps to make the workflow more complete");
	}

	const hasCollectInfo = workflow.steps.some((s) => s.type === "collect_info");
	if (!hasCollectInfo) {
		suggestions.push("Consider adding a step to collect information from the user");
	}

	const hasToolCall = workflow.steps.some((s) => s.type === "tool_call");
	if (!hasToolCall) {
		suggestions.push("Consider adding steps that execute actions using MCP tools");
	}

	const hasComplete = workflow.steps.some((s) => s.type === "complete");
	if (!hasComplete) {
		suggestions.push("Add a 'complete' step to mark the workflow as finished");
	}

	return suggestions;
}
