/**
 * Code Generator
 * 
 * Generates TypeScript code from workflow definitions.
 */

import type { WorkflowDefinition, WorkflowStepDefinition } from "./types";

/**
 * Generate TypeScript code for a workflow definition
 */
export function generateWorkflowCode(workflow: WorkflowDefinition): string {
	const workflowName = toPascalCase(workflow.name.replace(/[^a-zA-Z0-9]/g, "_"));
	const stepsCode = generateStepsCode(workflow.steps);
	const nextStepLogic = generateNextStepLogic(workflow);

	return `/**
 * ${workflow.name}
 * 
 * ${workflow.description || "Generated workflow"}
 * 
 * Type: ${workflow.type}
 * Initial Step: ${workflow.initialStep}
 */

import type { WorkflowDefinition, WorkflowStepDefinition } from "./types";

export const ${workflowName}Workflow: WorkflowDefinition = {
	type: "${workflow.type}",
	name: "${workflow.name}",
	description: ${JSON.stringify(workflow.description || "")},
	initialStep: "${workflow.initialStep}",
	steps: [
${stepsCode}
	],
};

/**
 * Get next step based on workflow state
 */
export function getNextStep${workflowName}(
	stepName: string,
	workflowState: Record<string, unknown>
): string | null {
${nextStepLogic}
	return null;
}
`;
}

/**
 * Generate code for workflow steps
 */
function generateStepsCode(steps: WorkflowStepDefinition[]): string {
	return steps
		.map((step, index) => {
			const stepCode = `		{
			name: "${step.name}",
			type: "${step.type}",
			description: ${JSON.stringify(step.description)},
${step.requiredData ? `			requiredData: ${JSON.stringify(step.requiredData)},\n` : ""}${step.toolName ? `			toolName: "${step.toolName}",\n` : ""}${step.nextStep ? `			nextStep: ${typeof step.nextStep === "string" ? `"${step.nextStep}"` : "null"},\n` : ""}		}`;
			return stepCode;
		})
		.join(",\n");
}

/**
 * Generate next step logic function
 */
function generateNextStepLogic(workflow: WorkflowDefinition): string {
	const cases = workflow.steps
		.map((step) => {
			if (!step.nextStep) {
				return `		case "${step.name}":
			return null;`;
			}

			if (typeof step.nextStep === "string") {
				return `		case "${step.name}":
			return "${step.nextStep}";`;
			}

			// Function case - generate conditional logic
			return `		case "${step.name}":
			// TODO: Implement conditional logic for ${step.name}
			// ${JSON.stringify(step.nextStep)}
			return null;`;
		})
		.join("\n");

	return `	switch (stepName) {
${cases}
		default:
			return null;
	}`;
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
	return str
		.split(/[_\s-]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
}

/**
 * Generate a complete workflow file
 */
export function generateWorkflowFile(workflow: WorkflowDefinition): string {
	const code = generateWorkflowCode(workflow);
	const fileName = `${workflow.type}-${workflow.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-workflow.ts`;

	return {
		fileName,
		code,
	};
}

/**
 * Validate generated code syntax (basic check)
 */
export function validateGeneratedCode(code: string): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Basic checks
	if (!code.includes("export const")) {
		errors.push("Missing export statement");
	}

	if (!code.includes("WorkflowDefinition")) {
		errors.push("Missing WorkflowDefinition type");
	}

	if (!code.includes("steps:")) {
		errors.push("Missing steps array");
	}

	// Check for balanced braces
	const openBraces = (code.match(/\{/g) || []).length;
	const closeBraces = (code.match(/\}/g) || []).length;
	if (openBraces !== closeBraces) {
		errors.push("Unbalanced braces in generated code");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
