/**
 * List Sync Workflow Implementation
 * 
 * Defines the list synchronization workflow steps:
 * 1. Fetch contacts with tag from GHL
 * 2. Get contact mappings
 * 3. Extract Aloware contact IDs
 * 4. Create or update Aloware call list
 * 5. Log sync operation
 */

import type { WorkflowDefinition, WorkflowState, ToolExecutionResult } from "./types";

/**
 * List sync workflow definition (GHL Tag → Aloware List)
 */
export const listSyncWorkflow: WorkflowDefinition = {
	type: "sync",
	name: "List Sync Workflow (GHL Tag → Aloware List)",
	description: "Synchronizes GHL tag to Aloware call list",
	initialStep: "fetch_tagged_contacts",
	steps: [
		{
			name: "fetch_tagged_contacts",
			type: "tool_call",
			description: "Fetch contacts with tag from GHL",
			requiredData: ["tagName"],
			toolName: "ghl_contacts_search",
			toolArgs: (state: WorkflowState) => ({
				tags: [state.collectedData.tagName as string],
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						taggedContacts: result.data,
					},
				};
			},
			nextStep: "get_contact_mappings",
		},
		{
			name: "get_contact_mappings",
			type: "tool_call",
			description: "Get contact mappings for GHL contacts",
			requiredData: ["taggedContacts"],
			toolName: "get_contact_mappings_batch",
			toolArgs: (state: WorkflowState) => {
				const contacts = state.collectedData.taggedContacts as Array<{ id?: string }>;
				return {
					ghlContactIds: contacts.map(c => c.id).filter(Boolean),
				};
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						mappings: result.data,
					},
				};
			},
			nextStep: "extract_aloware_ids",
		},
		{
			name: "extract_aloware_ids",
			type: "tool_call",
			description: "Extract Aloware contact IDs from mappings",
			requiredData: ["mappings"],
			toolName: "extract_aloware_contact_ids",
			toolArgs: (state: WorkflowState) => ({
				mappings: state.collectedData.mappings,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						alowareContactIds: result.data,
					},
				};
			},
			nextStep: "check_existing_list",
		},
		{
			name: "check_existing_list",
			type: "tool_call",
			description: "Check if Aloware list already exists",
			requiredData: ["tagName"],
			toolName: "aloware_lists_search",
			toolArgs: (state: WorkflowState) => ({
				name: state.collectedData.tagName as string,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						existingList: result.data,
					},
				};
			},
			nextStep: (state: WorkflowState) => {
				const existingList = state.collectedData.existingList;
				return existingList ? "update_list" : "create_list";
			},
		},
		{
			name: "create_list",
			type: "sync_list",
			description: "Create new Aloware call list",
			requiredData: ["tagName", "alowareContactIds"],
			syncConfig: {
				source: "ghl",
				target: "aloware",
				direction: "ghl_to_aloware",
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						listId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "log_sync",
		},
		{
			name: "update_list",
			type: "sync_list",
			description: "Update existing Aloware call list",
			requiredData: ["tagName", "alowareContactIds", "existingList"],
			syncConfig: {
				source: "ghl",
				target: "aloware",
				direction: "ghl_to_aloware",
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						listId: (result.data as { id?: string })?.id || (state.collectedData.existingList as { id?: string })?.id,
					},
				};
			},
			nextStep: "log_sync",
		},
		{
			name: "log_sync",
			type: "tool_call",
			description: "Log sync operation",
			requiredData: ["tagName", "listId"],
			toolName: "log_sync_operation",
			toolArgs: (state: WorkflowState) => ({
				direction: "ghl_to_aloware",
				entityType: "list",
				entityId: state.collectedData.tagName as string,
				sourceId: state.collectedData.tagName as string,
				targetId: state.collectedData.listId as string,
				status: "success",
			}),
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "List sync completed successfully",
		},
	],
};

/**
 * Get list sync workflow
 */
export function getListSyncWorkflow(): WorkflowDefinition {
	return listSyncWorkflow;
}
