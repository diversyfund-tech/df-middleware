/**
 * Call Sync Workflow Implementation
 * 
 * Defines the call synchronization workflow steps:
 * 1. Fetch call data from Aloware
 * 2. Ensure contact is synced first
 * 3. Build call note/summary
 * 4. Update GHL contact with call information
 * 5. Add tags based on call disposition
 * 6. Log sync operation
 */

import type { WorkflowDefinition, WorkflowState, ToolExecutionResult } from "./types";

/**
 * Call sync workflow definition (Aloware → GHL)
 */
export const callSyncWorkflow: WorkflowDefinition = {
	type: "sync",
	name: "Call Sync Workflow (Aloware → GHL)",
	description: "Synchronizes call data from Aloware to GoHighLevel",
	initialStep: "fetch_call_data",
	steps: [
		{
			name: "fetch_call_data",
			type: "tool_call",
			description: "Fetch call data from Aloware",
			requiredData: ["callId"],
			toolName: "aloware_calls_get",
			toolArgs: (state: WorkflowState) => ({
				id: state.collectedData.callId as string,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						callData: result.data,
					},
				};
			},
			nextStep: "fetch_contact_data",
		},
		{
			name: "fetch_contact_data",
			type: "tool_call",
			description: "Fetch contact data associated with call",
			requiredData: ["callData"],
			toolName: "aloware_contacts_get",
			toolArgs: (state: WorkflowState) => {
				const callData = state.collectedData.callData as { contact_id?: string };
				return {
					id: callData.contact_id as string,
				};
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						contactData: result.data,
					},
				};
			},
			nextStep: "ensure_contact_synced",
		},
		{
			name: "ensure_contact_synced",
			type: "sync_contact",
			description: "Ensure contact is synced to GHL before syncing call",
			requiredData: ["contactData"],
			syncConfig: {
				source: "aloware",
				target: "ghl",
				direction: "aloware_to_ghl",
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						ghlContactId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "build_call_note",
		},
		{
			name: "build_call_note",
			type: "tool_call",
			description: "Build call note/summary from call data",
			requiredData: ["callData"],
			toolName: "build_call_note",
			toolArgs: (state: WorkflowState) => ({
				callData: state.collectedData.callData,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						callNote: result.data,
					},
				};
			},
			nextStep: "update_ghl_contact",
		},
		{
			name: "update_ghl_contact",
			type: "tool_call",
			description: "Update GHL contact with call information",
			requiredData: ["ghlContactId", "callNote"],
			toolName: "ghl_contacts_update",
			toolArgs: (state: WorkflowState) => ({
				id: state.collectedData.ghlContactId as string,
				body: {
					notes: state.collectedData.callNote as string,
				},
			}),
			nextStep: "add_call_tags",
		},
		{
			name: "add_call_tags",
			type: "tool_call",
			description: "Add tags based on call disposition",
			requiredData: ["ghlContactId", "callData"],
			toolName: "ghl_contacts_add_tags",
			toolArgs: (state: WorkflowState) => {
				const callData = state.collectedData.callData as { disposition?: string; direction?: string };
				const tags: string[] = [];
				
				if (callData.disposition) {
					tags.push(`Call: ${callData.disposition}`);
				}
				if (callData.direction === "inbound") {
					tags.push("Inbound Call");
				} else if (callData.direction === "outbound") {
					tags.push("Outbound Call");
				}
				
				return {
					id: state.collectedData.ghlContactId as string,
					body: {
						tags,
					},
				};
			},
			nextStep: "log_sync",
		},
		{
			name: "log_sync",
			type: "tool_call",
			description: "Log sync operation",
			requiredData: ["callId", "ghlContactId"],
			toolName: "log_sync_operation",
			toolArgs: (state: WorkflowState) => ({
				direction: "aloware_to_ghl",
				entityType: "call",
				entityId: state.collectedData.callId as string,
				sourceId: state.collectedData.callId as string,
				targetId: state.collectedData.ghlContactId as string,
				status: "success",
			}),
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "Call sync completed successfully",
		},
	],
};

/**
 * Get call sync workflow
 */
export function getCallSyncWorkflow(): WorkflowDefinition {
	return callSyncWorkflow;
}
