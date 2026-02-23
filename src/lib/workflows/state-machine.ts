/**
 * Workflow State Machine
 * 
 * Handles workflow state transitions and step progression.
 */

import type { WorkflowState, WorkflowStepDefinition, StepResult } from "./types";

/**
 * Transition workflow to next step
 */
export function transitionToStep(
	currentState: WorkflowState,
	stepName: string,
	collectedData?: Record<string, unknown>
): WorkflowState {
	return {
		...currentState,
		step: stepName,
		collectedData: {
			...currentState.collectedData,
			...(collectedData || {}),
		},
	};
}

/**
 * Update collected data in workflow state
 */
export function updateCollectedData(
	currentState: WorkflowState,
	data: Record<string, unknown>
): WorkflowState {
	return {
		...currentState,
		collectedData: {
			...currentState.collectedData,
			...data,
		},
	};
}

/**
 * Record a decision point
 */
export function recordDecision(
	currentState: WorkflowState,
	decisionName: string,
	decision: boolean
): WorkflowState {
	return {
		...currentState,
		decisions: {
			...currentState.decisions,
			[decisionName]: decision,
		},
	};
}

/**
 * Determine next step based on step definition and current state
 */
export function getNextStep(
	stepDef: WorkflowStepDefinition,
	currentState: WorkflowState,
	stepResult: StepResult
): string | null {
	if (!stepDef.nextStep) {
		return null; // End of workflow
	}

	if (typeof stepDef.nextStep === "string") {
		return stepDef.nextStep;
	}

	// Function to determine next step
	return stepDef.nextStep(currentState);
}

/**
 * Check if required data is available for a step
 */
export function hasRequiredData(
	stepDef: WorkflowStepDefinition,
	state: WorkflowState
): boolean {
	if (!stepDef.requiredData || stepDef.requiredData.length === 0) {
		return true; // No requirements
	}

	return stepDef.requiredData.every(
		field => field in state.collectedData && state.collectedData[field] !== undefined
	);
}

/**
 * Apply state transformation on step success
 */
export function applySuccessTransformation(
	stepDef: WorkflowStepDefinition,
	currentState: WorkflowState,
	result: { success: boolean; data?: unknown; error?: string }
): WorkflowState {
	if (stepDef.onSuccess) {
		return stepDef.onSuccess(currentState, result);
	}

	// Default: just update state with result data if available
	if (result.data && typeof result.data === "object") {
		return updateCollectedData(currentState, result.data as Record<string, unknown>);
	}

	return currentState;
}

/**
 * Apply state transformation on step failure
 */
export function applyFailureTransformation(
	stepDef: WorkflowStepDefinition,
	currentState: WorkflowState,
	error: string
): WorkflowState {
	if (stepDef.onFailure) {
		return stepDef.onFailure(currentState, error);
	}

	// Default: record error in metadata
	return {
		...currentState,
		metadata: {
			...currentState.metadata,
			lastError: error,
		},
	};
}

/**
 * Initialize workflow state
 */
export function initializeWorkflowState(initialStep: string): WorkflowState {
	return {
		step: initialStep,
		collectedData: {},
		decisions: {},
		metadata: {},
	};
}

/**
 * Check if workflow is complete
 */
export function isWorkflowComplete(
	stepDef: WorkflowStepDefinition,
	stepResult: StepResult
): boolean {
	return stepDef.type === "complete" && stepResult.status === "completed";
}
