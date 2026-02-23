/**
 * Workflow Engine
 * 
 * Orchestrates workflow execution, manages state persistence,
 * and handles step transitions.
 */

import { db } from "@/server/db";
import { workflowExecutions, workflowSteps } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getClerkSessionToken } from "@/auth/clerk-token-manager";
import { executeTool } from "@/lib/mcp/tool-executor";
import { syncAlowareContactToGHL } from "@/lib/sync/contact-sync";
import { syncGHLContactToAloware } from "@/lib/sync/ghl-contact-sync";
import { syncAlowareCallToGHL } from "@/lib/sync/call-sync";
import { syncGHLTagToAlowareList } from "@/lib/sync/list-sync";
import { syncAlowareDNCToGHL } from "@/lib/sync/dnc-sync";
import { syncTextingMessageToGHL } from "@/lib/sync/texting-to-ghl";
import { syncTextingMessageToAloware } from "@/lib/sync/texting-to-aloware";
import type { AlowareContact } from "@/lib/aloware/types";
import { logger } from "@/lib/logger";
import type {
	WorkflowDefinition,
	WorkflowState,
	WorkflowStatus,
	StepResult,
	StepStatus,
	WorkflowMetadata,
} from "./types";
import {
	transitionToStep,
	updateCollectedData,
	getNextStep,
	hasRequiredData,
	applySuccessTransformation,
	applyFailureTransformation,
	isWorkflowComplete,
} from "./state-machine";

/**
 * Create a new workflow execution
 */
export async function createWorkflowExecution(
	agentId: string,
	workflowType: string,
	metadata?: WorkflowMetadata
): Promise<string> {
	const [execution] = await db
		.insert(workflowExecutions)
		.values({
			agentId,
			workflowType,
			status: "in_progress",
			workflowState: {
				step: "",
				collectedData: {},
				decisions: {},
			},
			metadata: metadata || {},
		})
		.returning({ id: workflowExecutions.id });

	if (!execution) {
		throw new Error("Failed to create workflow execution");
	}

	return execution.id;
}

/**
 * Get workflow execution by ID
 */
export async function getWorkflowExecution(executionId: string) {
	const execution = await db.query.workflowExecutions.findFirst({
		where: eq(workflowExecutions.id, executionId),
	});

	return execution;
}

/**
 * Update workflow state
 */
export async function updateWorkflowState(
	executionId: string,
	state: WorkflowState
): Promise<void> {
	await db
		.update(workflowExecutions)
		.set({
			workflowState: state,
		})
		.where(eq(workflowExecutions.id, executionId));
}

/**
 * Update workflow status
 */
export async function updateWorkflowStatus(
	executionId: string,
	status: WorkflowStatus,
	completedAt?: Date
): Promise<void> {
	await db
		.update(workflowExecutions)
		.set({
			status,
			completedAt: completedAt || (status === "completed" || status === "failed" || status === "abandoned" ? new Date() : undefined),
		})
		.where(eq(workflowExecutions.id, executionId));
}

/**
 * Create workflow step record
 */
export async function createWorkflowStep(
	executionId: string,
	stepType: string,
	stepName: string,
	status: StepStatus = "pending"
): Promise<string> {
	const [step] = await db
		.insert(workflowSteps)
		.values({
			executionId,
			stepType,
			stepName,
			status,
		})
		.returning({ id: workflowSteps.id });

	if (!step) {
		throw new Error("Failed to create workflow step");
	}

	return step.id;
}

/**
 * Update workflow step
 */
export async function updateWorkflowStep(
	stepId: string,
	updates: {
		status?: StepStatus;
		toolCalled?: string;
		toolArgs?: Record<string, unknown>;
		result?: unknown;
		errorMessage?: string;
	}
): Promise<void> {
	await db
		.update(workflowSteps)
		.set(updates)
		.where(eq(workflowSteps.id, stepId));
}

/**
 * Execute a workflow step
 */
export async function executeWorkflowStep(
	executionId: string,
	workflowDef: WorkflowDefinition,
	stepName: string,
	toolArgs?: Record<string, unknown>
): Promise<StepResult> {
	// Get current execution
	const execution = await getWorkflowExecution(executionId);
	if (!execution) {
		throw new Error(`Workflow execution ${executionId} not found`);
	}

	// Find step definition
	const stepDef = workflowDef.steps.find(s => s.name === stepName);
	if (!stepDef) {
		throw new Error(`Step ${stepName} not found in workflow definition`);
	}

	// Get current state
	const currentState = (execution.workflowState as WorkflowState) || {
		step: workflowDef.initialStep,
		collectedData: {},
		decisions: {},
	};

	// Check if required data is available
	if (!hasRequiredData(stepDef, currentState)) {
		const missing = stepDef.requiredData?.filter(
			field => !(field in currentState.collectedData)
		) || [];
		return {
			stepName,
			status: "failed",
			error: `Missing required data: ${missing.join(", ")}`,
		};
	}

	// Create step record
	const stepId = await createWorkflowStep(executionId, stepDef.type, stepName, "in_progress");

	try {
		let result: StepResult;

		// Execute step based on type
		if (stepDef.type === "sync_contact") {
			// Execute contact sync operation
			try {
				const syncConfig = stepDef.syncConfig;
				const sourceContact = currentState.collectedData.sourceContact || currentState.collectedData.contactData;
				
				if (!sourceContact) {
					throw new Error("Source contact data is required for sync_contact step");
				}

				let syncResult: string;
				const correlationId = executionId;

				if (syncConfig?.direction === "aloware_to_ghl" || syncConfig?.source === "aloware") {
					// Sync Aloware contact to GHL
					syncResult = await syncAlowareContactToGHL(
						sourceContact as any,
						correlationId
					);
				} else if (syncConfig?.direction === "ghl_to_aloware" || syncConfig?.source === "ghl") {
					// Sync GHL contact to Aloware
					const ghlContactId = currentState.collectedData.contactId as string;
					syncResult = await syncGHLContactToAloware(ghlContactId, { correlationId });
				} else {
					throw new Error(`Invalid sync configuration for sync_contact: ${JSON.stringify(syncConfig)}`);
				}

				const toolResult = {
					success: true,
					data: { id: syncResult },
				};

				await updateWorkflowStep(stepId, {
					status: "completed",
					result: toolResult,
				});

				const newState = applySuccessTransformation(stepDef, currentState, toolResult);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "completed",
					toolResult,
				};
			} catch (error: any) {
				const errorMessage = error.message || String(error);
				logger.error({ executionId, stepName, error }, "Contact sync failed");
				
				await updateWorkflowStep(stepId, {
					status: "failed",
					errorMessage,
				});

				const newState = applyFailureTransformation(stepDef, currentState, errorMessage);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "failed",
					error: errorMessage,
				};
			}
		} else if (stepDef.type === "sync_call") {
			// Execute call sync operation
			try {
				const callData = currentState.collectedData.callData;
				const contactData = currentState.collectedData.contactData;
				
				if (!callData || !contactData) {
					throw new Error("Call data and contact data are required for sync_call step");
				}

				const correlationId = executionId;
				await syncAlowareCallToGHL(
					callData as any,
					contactData as any,
					correlationId
				);

				const toolResult = {
					success: true,
					data: { synced: true },
				};

				await updateWorkflowStep(stepId, {
					status: "completed",
					result: toolResult,
				});

				const newState = applySuccessTransformation(stepDef, currentState, toolResult);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "completed",
					toolResult,
				};
			} catch (error: any) {
				const errorMessage = error.message || String(error);
				logger.error({ executionId, stepName, error }, "Call sync failed");
				
				await updateWorkflowStep(stepId, {
					status: "failed",
					errorMessage,
				});

				const newState = applyFailureTransformation(stepDef, currentState, errorMessage);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "failed",
					error: errorMessage,
				};
			}
		} else if (stepDef.type === "sync_message") {
			// Execute message sync operation
			try {
				const syncConfig = stepDef.syncConfig;
				const messageData = currentState.collectedData.messageData;
				
				if (!messageData) {
					throw new Error("Message data is required for sync_message step");
				}

				const correlationId = executionId;

				if (syncConfig?.target === "ghl") {
					await syncTextingMessageToGHL(messageData as any, { correlationId });
				} else if (syncConfig?.target === "aloware") {
					await syncTextingMessageToAloware(messageData as any, { correlationId });
				} else {
					throw new Error(`Invalid sync configuration for sync_message: ${JSON.stringify(syncConfig)}`);
				}

				const toolResult = {
					success: true,
					data: { synced: true },
				};

				await updateWorkflowStep(stepId, {
					status: "completed",
					result: toolResult,
				});

				const newState = applySuccessTransformation(stepDef, currentState, toolResult);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "completed",
					toolResult,
				};
			} catch (error: any) {
				const errorMessage = error.message || String(error);
				logger.error({ executionId, stepName, error }, "Message sync failed");
				
				await updateWorkflowStep(stepId, {
					status: "failed",
					errorMessage,
				});

				const newState = applyFailureTransformation(stepDef, currentState, errorMessage);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "failed",
					error: errorMessage,
				};
			}
		} else if (stepDef.type === "sync_list") {
			// Execute list sync operation
			try {
				const tagName = currentState.collectedData.tagName as string;
				
				if (!tagName) {
					throw new Error("Tag name is required for sync_list step");
				}

				const correlationId = executionId;
				const listId = await syncGHLTagToAlowareList(tagName, correlationId);

				const toolResult = {
					success: true,
					data: { id: listId },
				};

				await updateWorkflowStep(stepId, {
					status: "completed",
					result: toolResult,
				});

				const newState = applySuccessTransformation(stepDef, currentState, toolResult);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "completed",
					toolResult,
				};
			} catch (error: any) {
				const errorMessage = error.message || String(error);
				logger.error({ executionId, stepName, error }, "List sync failed");
				
				await updateWorkflowStep(stepId, {
					status: "failed",
					errorMessage,
				});

				const newState = applyFailureTransformation(stepDef, currentState, errorMessage);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "failed",
					error: errorMessage,
				};
			}
		} else if (stepDef.type === "sync_dnc") {
			// Execute DNC sync operation
			try {
				const contactId = currentState.collectedData.contactId as string;
				const payload = currentState.collectedData.payload as Record<string, unknown> || {};
				
				if (!contactId) {
					throw new Error("Contact ID is required for sync_dnc step");
				}

				const correlationId = executionId;
				await syncAlowareDNCToGHL(contactId, payload, correlationId);

				const toolResult = {
					success: true,
					data: { synced: true },
				};

				await updateWorkflowStep(stepId, {
					status: "completed",
					result: toolResult,
				});

				const newState = applySuccessTransformation(stepDef, currentState, toolResult);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "completed",
					toolResult,
				};
			} catch (error: any) {
				const errorMessage = error.message || String(error);
				logger.error({ executionId, stepName, error }, "DNC sync failed");
				
				await updateWorkflowStep(stepId, {
					status: "failed",
					errorMessage,
				});

				const newState = applyFailureTransformation(stepDef, currentState, errorMessage);
				await updateWorkflowState(executionId, newState);

				result = {
					stepName,
					status: "failed",
					error: errorMessage,
				};
			}
		} else if (stepDef.type === "tool_call" && stepDef.toolName) {
			// Execute MCP tool
			const authToken = await getClerkSessionToken();
			const toolResult = await executeTool(stepDef.toolName, toolArgs || {}, authToken);

			await updateWorkflowStep(stepId, {
				status: toolResult.success ? "completed" : "failed",
				toolCalled: stepDef.toolName,
				toolArgs: toolArgs || {},
				result: toolResult,
				errorMessage: toolResult.error,
			});

			// Apply state transformation
			const newState = toolResult.success
				? applySuccessTransformation(stepDef, currentState, toolResult)
				: applyFailureTransformation(stepDef, currentState, toolResult.error || "Tool execution failed");

			await updateWorkflowState(executionId, newState);

			result = {
				stepName,
				status: toolResult.success ? "completed" : "failed",
				toolCalled: stepDef.toolName,
				toolResult,
				error: toolResult.error,
			};
		} else if (stepDef.type === "collect_info") {
			// Information collection step - just update state
			const newState = toolArgs
				? updateCollectedData(currentState, toolArgs)
				: currentState;

			await updateWorkflowState(executionId, newState);
			await updateWorkflowStep(stepId, {
				status: "completed",
				result: { collectedData: toolArgs },
			});

			result = {
				stepName,
				status: "completed",
				collectedData: toolArgs,
			};
		} else if (stepDef.type === "decision") {
			// Decision step - record decision
			const decision = toolArgs?.decision === true;
			const newState = {
				...currentState,
				decisions: {
					...currentState.decisions,
					[stepName]: decision,
				},
			};

			await updateWorkflowState(executionId, newState);
			await updateWorkflowStep(stepId, {
				status: "completed",
				result: { decision },
			});

			result = {
				stepName,
				status: "completed",
			};
		} else {
			// Complete step or other types
			await updateWorkflowStep(stepId, {
				status: "completed",
			});

			result = {
				stepName,
				status: "completed",
			};
		}

		// Determine next step
		const nextStep = getNextStep(stepDef, currentState, result);
		if (nextStep) {
			result.nextStep = nextStep;
		} else if (isWorkflowComplete(stepDef, result)) {
			// Workflow is complete
			await updateWorkflowStatus(executionId, "completed");
		}

		return result;
	} catch (error: any) {
		const errorMessage = error.message || String(error);
		await updateWorkflowStep(stepId, {
			status: "failed",
			errorMessage,
		});

		const newState = applyFailureTransformation(stepDef, currentState, errorMessage);
		await updateWorkflowState(executionId, newState);

		return {
			stepName,
			status: "failed",
			error: errorMessage,
		};
	}
}

/**
 * Get workflow steps for an execution
 */
export async function getWorkflowSteps(executionId: string) {
	return await db.query.workflowSteps.findMany({
		where: eq(workflowSteps.executionId, executionId),
		orderBy: (steps, { asc }) => [asc(steps.timestamp)],
	});
}
