/**
 * Conversation Parser
 * 
 * Extracts workflow definitions from AI conversation messages.
 */

import type { WorkflowDefinition, WorkflowStepDefinition } from "./types";

export interface ParsedWorkflow {
	workflow: WorkflowDefinition | null;
	confidence: number;
	extractionMethod: "json_block" | "structured_text" | "none";
}

/**
 * Parse workflow definition from conversation messages
 */
export function parseWorkflowFromConversation(
	messages: Array<{ role: "user" | "assistant"; content: string }>
): ParsedWorkflow {
	// Look through all assistant messages for workflow definitions
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role === "assistant") {
			const parsed = extractWorkflowFromMessage(message.content);
			if (parsed.workflow) {
				return parsed;
			}
		}
	}

	return {
		workflow: null,
		confidence: 0,
		extractionMethod: "none",
	};
}

/**
 * Extract workflow definition from a single message
 */
function extractWorkflowFromMessage(message: string): ParsedWorkflow {
	// Method 1: JSON code block
	const jsonBlockMatch = message.match(/```json\s*([\s\S]*?)\s*```/);
	if (jsonBlockMatch) {
		try {
			let parsed = JSON.parse(jsonBlockMatch[1]);
			
			// If parsed object has a "workflow" property, extract it
			if ((parsed as any).workflow) {
				parsed = (parsed as any).workflow;
			}
			
			if (isWorkflowDefinition(parsed)) {
				return {
					workflow: parsed,
					confidence: 0.9,
					extractionMethod: "json_block",
				};
			}
		} catch (e) {
			console.warn("[conversation-parser] JSON parse error:", e);
			// Not valid JSON, continue to next method
		}
	}

	// Method 2: JSON without code block markers (more flexible pattern)
	const jsonPatterns = [
		/\{[\s\S]*?"type"[\s\S]*?"steps"[\s\S]*?\}/,
		/\{[\s\S]*?"workflow"[\s\S]*?"steps"[\s\S]*?\}/,
		/\{[\s\S]*?"steps"[\s\S]*?\}[\s\S]*?"type"/,
	];
	
	for (const pattern of jsonPatterns) {
		const jsonMatch = message.match(pattern);
		if (jsonMatch) {
			try {
				// Try to parse the matched JSON
				let jsonStr = jsonMatch[0];
				
				// If it's nested in a "workflow" property, extract it
				if (jsonStr.includes('"workflow"')) {
					const workflowMatch = jsonStr.match(/"workflow"\s*:\s*(\{[\s\S]*\})/);
					if (workflowMatch) {
						jsonStr = workflowMatch[1];
					}
				}
				
				const parsed = JSON.parse(jsonStr);
				
				// If parsed object has a "workflow" property, use that
				const workflowObj = (parsed as any).workflow || parsed;
				
				if (isWorkflowDefinition(workflowObj)) {
					return {
						workflow: workflowObj,
						confidence: 0.8,
						extractionMethod: "structured_text",
					};
				}
			} catch (e) {
				// Try next pattern
				continue;
			}
		}
	}

	// Method 3: Try to construct from structured text description
	const structuredWorkflow = parseStructuredText(message);
	if (structuredWorkflow) {
		return {
			workflow: structuredWorkflow,
			confidence: 0.6,
			extractionMethod: "structured_text",
		};
	}

	return {
		workflow: null,
		confidence: 0,
		extractionMethod: "none",
	};
}

/**
 * Parse workflow from structured text description
 * This is a fallback when JSON isn't available
 */
function parseStructuredText(message: string): WorkflowDefinition | null {
	// Look for workflow type
	const typeMatch = message.match(/workflow\s+type[:\s]+(sales|support|appointment|custom)/i);
	const workflowType = typeMatch?.[1] || "custom";

	// Look for workflow name
	const nameMatch = message.match(/workflow\s+name[:\s]+"([^"]+)"/i) ||
		message.match(/name[:\s]+"([^"]+)"/i);
	const workflowName = nameMatch?.[1] || "Untitled Workflow";

	// Try to parse workflow definition with stepType/purpose format (multiple patterns)
	const workflowPatterns = [
		/"workflow"\s*:\s*\{[\s\S]*?"steps"[\s\S]*?\[([\s\S]*?)\]/,
		/"steps"[\s\S]*?\[([\s\S]*?)\]/,
	];
	
	for (const pattern of workflowPatterns) {
		const workflowDefMatch = message.match(pattern);
		if (workflowDefMatch) {
			const stepsText = workflowDefMatch[1];
			
			// Try multiple step matching patterns
			const stepPatterns = [
				/\{\s*"stepType"\s*:\s*"([^"]+)"[\s\S]*?"purpose"\s*:\s*"([^"]+)"[\s\S]*?"toolName"\s*:\s*"([^"]+)"?[\s\S]*?\}/g,
				/\{\s*"stepType"\s*:\s*"([^"]+)"[\s\S]*?"purpose"\s*:\s*"([^"]+)"[\s\S]*?\}/g,
				/\{\s*"type"\s*:\s*"([^"]+)"[\s\S]*?"description"\s*:\s*"([^"]+)"[\s\S]*?"toolName"\s*:\s*"([^"]+)"?[\s\S]*?\}/g,
			];
			
			for (const stepPattern of stepPatterns) {
				const stepMatches = stepsText.matchAll(stepPattern);
				const steps: WorkflowStepDefinition[] = [];
				
				for (const match of stepMatches) {
					const stepTypeRaw = (match[1] || "").toLowerCase();
					const purpose = match[2] || "";
					const toolNameRaw = match[3] || "";
					
					// Map stepType to our type system
					let stepType: WorkflowStepDefinition["type"] = "collect_info";
					if (stepTypeRaw.includes("pause") || stepTypeRaw.includes("wait")) {
						stepType = "collect_info";
					} else if (stepTypeRaw.includes("decision")) {
						stepType = "decision";
					} else if (stepTypeRaw.includes("tool_call") || stepTypeRaw.includes("tool")) {
						stepType = "tool_call";
					} else if (stepTypeRaw.includes("complete") || stepTypeRaw.includes("end")) {
						stepType = "complete";
					}
					
					const stepName = `step_${steps.length + 1}`;
					steps.push({
						name: stepName,
						type: stepType,
						description: purpose || `Step ${steps.length + 1}`,
						toolName: toolNameRaw && toolNameRaw !== "undefined" && toolNameRaw !== "null" ? toolNameRaw : undefined,
						nextStep: steps.length === 0 ? null : `step_${steps.length + 2}`,
					});
				}
				
				if (steps.length > 0) {
					steps[steps.length - 1].nextStep = null;
					return {
						type: workflowType as WorkflowDefinition["type"],
						name: workflowName,
						description: message.substring(0, 200),
						initialStep: steps[0]?.name || "step_1",
						steps,
					};
				}
			}
		}
	}

	// Look for steps in simpler format
	const stepMatches = message.matchAll(/step\s+\d+[:\s]+([^\n]+)/gi);
	const steps: WorkflowStepDefinition[] = [];

	for (const match of stepMatches) {
		const stepText = match[1].toLowerCase();
		let stepType: WorkflowStepDefinition["type"] = "collect_info";
		let toolName: string | undefined;

		if (stepText.includes("collect") || stepText.includes("gather")) {
			stepType = "collect_info";
		} else if (stepText.includes("call") || stepText.includes("execute") || stepText.includes("tool")) {
			stepType = "tool_call";
			// Try to extract tool name
			const toolMatch = stepText.match(/(\w+_\w+)/);
			if (toolMatch) {
				toolName = toolMatch[1];
			}
		} else if (stepText.includes("decision") || stepText.includes("check") || stepText.includes("if")) {
			stepType = "decision";
		} else if (stepText.includes("complete") || stepText.includes("finish") || stepText.includes("end")) {
			stepType = "complete";
		}

		const stepName = `step_${steps.length + 1}`;
		steps.push({
			name: stepName,
			type: stepType,
			description: match[1].trim(),
			toolName,
			nextStep: steps.length === 0 ? null : `step_${steps.length + 2}`,
		});
	}

	if (steps.length === 0) {
		return null;
	}

	// Set last step's nextStep to null
	if (steps.length > 0) {
		steps[steps.length - 1].nextStep = null;
	}

	return {
		type: workflowType as WorkflowDefinition["type"],
		name: workflowName,
		description: message.substring(0, 200), // Use first 200 chars as description
		initialStep: steps[0]?.name || "step_1",
		steps,
	};
}

/**
 * Type guard to check if object is a WorkflowDefinition
 */
function isWorkflowDefinition(obj: unknown): obj is WorkflowDefinition {
	if (!obj || typeof obj !== "object") {
		console.log("[conversation-parser] Not an object:", typeof obj);
		return false;
	}
	const wf = obj as Record<string, unknown>;
	
	// Check required fields
	if (typeof wf.type !== "string") {
		console.log("[conversation-parser] Missing or invalid type:", wf.type);
		return false;
	}
	if (typeof wf.name !== "string") {
		console.log("[conversation-parser] Missing or invalid name:", wf.name);
		return false;
	}
	if (typeof wf.initialStep !== "string") {
		console.log("[conversation-parser] Missing or invalid initialStep:", wf.initialStep);
		return false;
	}
	if (!Array.isArray(wf.steps)) {
		console.log("[conversation-parser] Missing or invalid steps array:", wf.steps);
		return false;
	}
	if (wf.steps.length === 0) {
		console.log("[conversation-parser] Steps array is empty");
		return false;
	}
	
	// Check that steps are valid
	const validSteps = wf.steps.every((s, idx) => {
		if (!s || typeof s !== "object") {
			console.log(`[conversation-parser] Step ${idx} is not an object:`, s);
			return false;
		}
		const step = s as Record<string, unknown>;
		if (typeof step.name !== "string") {
			console.log(`[conversation-parser] Step ${idx} missing name:`, step);
			return false;
		}
		if (typeof step.type !== "string") {
			console.log(`[conversation-parser] Step ${idx} missing type:`, step);
			return false;
		}
		if (typeof step.description !== "string") {
			console.log(`[conversation-parser] Step ${idx} missing description:`, step);
			return false;
		}
		return true;
	});
	
	if (!validSteps) {
		console.log("[conversation-parser] Some steps are invalid");
		return false;
	}
	
	console.log("[conversation-parser] Valid workflow definition:", {
		type: wf.type,
		name: wf.name,
		stepsCount: wf.steps.length,
	});
	
	return true;
}

/**
 * Extract questions from AI response
 */
export function extractQuestions(message: string): string[] {
	const questions: string[] = [];
	
	// Find sentences ending with ?
	const questionMatches = message.matchAll(/[^.!?]*\?/g);
	for (const match of questionMatches) {
		const question = match[0].trim();
		if (question.length > 10) { // Filter out very short questions
			questions.push(question);
		}
	}

	return questions;
}
