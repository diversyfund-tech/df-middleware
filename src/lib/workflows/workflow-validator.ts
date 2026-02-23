/**
 * Workflow Validator
 * 
 * Validates workflow definitions for correctness and completeness.
 */

import type { WorkflowDefinition, WorkflowStepDefinition } from "./types";

export interface ValidationError {
	step?: string;
	field?: string;
	message: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationError[];
}

/**
 * Validate a workflow definition
 */
export async function validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult> {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	// Basic structure validation
	if (!workflow.name || workflow.name.trim().length === 0) {
		errors.push({ message: "Workflow name is required" });
	}

	if (!workflow.initialStep) {
		errors.push({ message: "Initial step is required" });
	}

	if (!workflow.steps || workflow.steps.length === 0) {
		errors.push({ message: "Workflow must have at least one step" });
	}

	// Validate initial step exists
	if (workflow.initialStep && workflow.steps) {
		const initialStepExists = workflow.steps.some((s) => s.name === workflow.initialStep);
		if (!initialStepExists) {
			errors.push({
				message: `Initial step "${workflow.initialStep}" not found in steps`,
			});
		}
	}

	// Validate each step
	const stepNames = new Set<string>();
	for (const step of workflow.steps || []) {
		// Check for duplicate step names
		if (stepNames.has(step.name)) {
			errors.push({
				step: step.name,
				message: `Duplicate step name: ${step.name}`,
			});
		}
		stepNames.add(step.name);

		// Validate step
		const stepErrors = await validateStep(step, workflow);
		errors.push(...stepErrors);
	}

	// Validate step references
	if (workflow.steps) {
		for (const step of workflow.steps) {
			if (step.nextStep && typeof step.nextStep === "string") {
				const nextStepExists = workflow.steps.some((s) => s.name === step.nextStep);
				if (!nextStepExists) {
					errors.push({
						step: step.name,
						field: "nextStep",
						message: `Next step "${step.nextStep}" not found`,
					});
				}
			}
		}
	}

	// Check for unreachable steps
	if (workflow.steps) {
		const reachableSteps = new Set<string>();
		function markReachable(stepName: string) {
			if (reachableSteps.has(stepName)) return;
			reachableSteps.add(stepName);

			const step = workflow.steps.find((s) => s.name === stepName);
			if (step?.nextStep && typeof step.nextStep === "string") {
				markReachable(step.nextStep);
			}
		}

		markReachable(workflow.initialStep);

		for (const step of workflow.steps) {
			if (!reachableSteps.has(step.name)) {
				warnings.push({
					step: step.name,
					message: `Step "${step.name}" is unreachable from initial step`,
				});
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Validate a single step
 */
async function validateStep(
	step: WorkflowStepDefinition,
	workflow: WorkflowDefinition
): Promise<ValidationError[]> {
	const errors: ValidationError[] = [];

	if (!step.name || step.name.trim().length === 0) {
		errors.push({
			step: step.name,
			message: "Step name is required",
		});
	}

	if (!step.type) {
		errors.push({
			step: step.name,
			field: "type",
			message: "Step type is required",
		});
	} else if (!["collect_info", "tool_call", "decision", "complete"].includes(step.type)) {
		errors.push({
			step: step.name,
			field: "type",
			message: `Invalid step type: ${step.type}`,
		});
	}

	if (!step.description || step.description.trim().length === 0) {
		errors.push({
			step: step.name,
			field: "description",
			message: "Step description is required",
		});
	}

	// Validate tool_call steps have toolName
	if (step.type === "tool_call" && !step.toolName) {
		errors.push({
			step: step.name,
			field: "toolName",
			message: "Tool call steps must specify a toolName",
		});
	}

	// Validate tool exists (if toolName specified)
	// Note: Tool validation is skipped on client-side to avoid Node.js module imports
	// Tools will be validated server-side when saving workflows
	if (step.toolName && typeof window === "undefined") {
		try {
			// Only validate tools on server-side
			const { getAllTools } = await import("@/lib/mcp/tool-registry");
			const tools = await getAllTools();
			const toolExists = tools.some((t) => t.name === step.toolName);
			if (!toolExists) {
				errors.push({
					step: step.name,
					field: "toolName",
					message: `Tool "${step.toolName}" not found in available tools`,
				});
			}
		} catch (error) {
			// If we can't load tools, just warn (this is expected on client-side)
			console.warn(`[workflow-validator] Could not validate tool: ${error}`);
		}
	}

	// Validate requiredData references exist in workflow
	if (step.requiredData && step.requiredData.length > 0) {
		// Check if required data can be collected before this step
		// This is a simplified check - in reality we'd need to trace the workflow
		const canCollect = checkDataAvailability(step.name, step.requiredData, workflow);
		if (!canCollect) {
			errors.push({
				step: step.name,
				field: "requiredData",
				message: `Required data may not be available before step "${step.name}"`,
			});
		}
	}

	return errors;
}

/**
 * Check if required data can be collected before a step
 * Simplified version - checks if any previous step collects the data
 */
function checkDataAvailability(
	stepName: string,
	requiredData: string[],
	workflow: WorkflowDefinition
): boolean {
	// Find all steps that come before this step
	const beforeSteps = getStepsBefore(stepName, workflow);
	
	// Check if any step before collects the required data
	// This is simplified - in reality we'd need to track what each step collects
	// For now, we'll assume collect_info steps can collect any data
	const hasCollectInfoSteps = beforeSteps.some((s) => s.type === "collect_info");
	
	// If we have collect_info steps before, assume they can collect the data
	// This is a simplified heuristic
	return hasCollectInfoSteps || requiredData.length === 0;
}

/**
 * Get all steps that come before a given step
 */
function getStepsBefore(
	stepName: string,
	workflow: WorkflowDefinition
): WorkflowStepDefinition[] {
	const beforeSteps: WorkflowStepDefinition[] = [];
	const visited = new Set<string>();

	function traverse(currentStepName: string) {
		if (visited.has(currentStepName)) return;
		if (currentStepName === stepName) return;

		visited.add(currentStepName);
		const step = workflow.steps.find((s) => s.name === currentStepName);
		if (!step) return;

		beforeSteps.push(step);

		if (step.nextStep && typeof step.nextStep === "string") {
			traverse(step.nextStep);
		}
	}

	traverse(workflow.initialStep);
	return beforeSteps;
}
