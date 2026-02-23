/**
 * Contact Sync Workflow Implementation
 * 
 * Defines the contact synchronization workflow steps:
 * 1. Fetch source contact data
 * 2. Check for existing mapping
 * 3. Transform data if needed
 * 4. Sync to target system
 * 5. Update/create mapping
 * 6. Log sync operation
 */

import type { WorkflowDefinition, WorkflowState, ToolExecutionResult } from "./types";

/**
 * Contact sync workflow definition (Aloware → GHL)
 */
export const contactSyncWorkflowAlowareToGHL: WorkflowDefinition = {
	type: "sync",
	name: "Contact Sync Workflow (Aloware → GHL)",
	description: "Synchronizes contact from Aloware to GoHighLevel",
	initialStep: "fetch_source_contact",
	steps: [
		{
			name: "fetch_source_contact",
			type: "tool_call",
			description: "Fetch contact data from Aloware",
			requiredData: ["contactId"],
			toolName: "aloware_contacts_get",
			toolArgs: (state: WorkflowState) => ({
				id: state.collectedData.contactId as string,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						sourceContact: result.data,
					},
				};
			},
			nextStep: "check_mapping",
		},
		{
			name: "check_mapping",
			type: "tool_call",
			description: "Check if contact mapping already exists",
			requiredData: ["contactId"],
			toolName: "get_contact_mapping",
			toolArgs: (state: WorkflowState) => ({
				alowareContactId: state.collectedData.contactId as string,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						mapping: result.data,
					},
				};
			},
			nextStep: (state: WorkflowState) => {
				const mapping = state.collectedData.mapping;
				return mapping ? "update_existing_contact" : "create_new_contact";
			},
		},
		{
			name: "create_new_contact",
			type: "sync_contact",
			description: "Create new contact in GHL",
			requiredData: ["sourceContact"],
			syncConfig: {
				source: "aloware",
				target: "ghl",
				direction: "aloware_to_ghl",
				conflictResolution: "source_wins",
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
			nextStep: "create_mapping",
		},
		{
			name: "update_existing_contact",
			type: "sync_contact",
			description: "Update existing contact in GHL",
			requiredData: ["sourceContact", "mapping"],
			syncConfig: {
				source: "aloware",
				target: "ghl",
				direction: "aloware_to_ghl",
				conflictResolution: "source_wins",
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						ghlContactId: (result.data as { id?: string })?.id || (state.collectedData.mapping as { ghlContactId?: string })?.ghlContactId,
					},
				};
			},
			nextStep: "update_mapping",
		},
		{
			name: "create_mapping",
			type: "tool_call",
			description: "Create contact mapping record",
			requiredData: ["contactId", "ghlContactId"],
			toolName: "create_contact_mapping",
			toolArgs: (state: WorkflowState) => ({
				alowareContactId: state.collectedData.contactId as string,
				ghlContactId: state.collectedData.ghlContactId as string,
			}),
			nextStep: "log_sync",
		},
		{
			name: "update_mapping",
			type: "tool_call",
			description: "Update contact mapping record",
			requiredData: ["contactId", "ghlContactId"],
			toolName: "update_contact_mapping",
			toolArgs: (state: WorkflowState) => ({
				alowareContactId: state.collectedData.contactId as string,
				ghlContactId: state.collectedData.ghlContactId as string,
			}),
			nextStep: "log_sync",
		},
		{
			name: "log_sync",
			type: "tool_call",
			description: "Log sync operation",
			requiredData: ["contactId", "ghlContactId"],
			toolName: "log_sync_operation",
			toolArgs: (state: WorkflowState) => ({
				direction: "aloware_to_ghl",
				entityType: "contact",
				entityId: state.collectedData.contactId as string,
				sourceId: state.collectedData.contactId as string,
				targetId: state.collectedData.ghlContactId as string,
				status: "success",
			}),
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "Contact sync completed successfully",
		},
	],
};

/**
 * Contact sync workflow definition (GHL → Aloware)
 */
export const contactSyncWorkflowGHLToAloware: WorkflowDefinition = {
	type: "sync",
	name: "Contact Sync Workflow (GHL → Aloware)",
	description: "Synchronizes contact from GoHighLevel to Aloware",
	initialStep: "fetch_source_contact",
	steps: [
		{
			name: "fetch_source_contact",
			type: "tool_call",
			description: "Fetch contact data from GHL",
			requiredData: ["contactId"],
			toolName: "ghl_contacts_get",
			toolArgs: (state: WorkflowState) => ({
				id: state.collectedData.contactId as string,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						sourceContact: result.data,
					},
				};
			},
			nextStep: "check_mapping",
		},
		{
			name: "check_mapping",
			type: "tool_call",
			description: "Check if contact mapping already exists",
			requiredData: ["contactId"],
			toolName: "get_contact_mapping",
			toolArgs: (state: WorkflowState) => ({
				ghlContactId: state.collectedData.contactId as string,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						mapping: result.data,
					},
				};
			},
			nextStep: (state: WorkflowState) => {
				const mapping = state.collectedData.mapping;
				return mapping ? "update_existing_contact" : "create_new_contact";
			},
		},
		{
			name: "create_new_contact",
			type: "sync_contact",
			description: "Create new contact in Aloware",
			requiredData: ["sourceContact"],
			syncConfig: {
				source: "ghl",
				target: "aloware",
				direction: "ghl_to_aloware",
				conflictResolution: "source_wins",
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						alowareContactId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "create_mapping",
		},
		{
			name: "update_existing_contact",
			type: "sync_contact",
			description: "Update existing contact in Aloware",
			requiredData: ["sourceContact", "mapping"],
			syncConfig: {
				source: "ghl",
				target: "aloware",
				direction: "ghl_to_aloware",
				conflictResolution: "source_wins",
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						alowareContactId: (result.data as { id?: string })?.id || (state.collectedData.mapping as { alowareContactId?: string })?.alowareContactId,
					},
				};
			},
			nextStep: "update_mapping",
		},
		{
			name: "create_mapping",
			type: "tool_call",
			description: "Create contact mapping record",
			requiredData: ["contactId", "alowareContactId"],
			toolName: "create_contact_mapping",
			toolArgs: (state: WorkflowState) => ({
				ghlContactId: state.collectedData.contactId as string,
				alowareContactId: state.collectedData.alowareContactId as string,
			}),
			nextStep: "log_sync",
		},
		{
			name: "update_mapping",
			type: "tool_call",
			description: "Update contact mapping record",
			requiredData: ["contactId", "alowareContactId"],
			toolName: "update_contact_mapping",
			toolArgs: (state: WorkflowState) => ({
				ghlContactId: state.collectedData.contactId as string,
				alowareContactId: state.collectedData.alowareContactId as string,
			}),
			nextStep: "log_sync",
		},
		{
			name: "log_sync",
			type: "tool_call",
			description: "Log sync operation",
			requiredData: ["contactId", "alowareContactId"],
			toolName: "log_sync_operation",
			toolArgs: (state: WorkflowState) => ({
				direction: "ghl_to_aloware",
				entityType: "contact",
				entityId: state.collectedData.contactId as string,
				sourceId: state.collectedData.contactId as string,
				targetId: state.collectedData.alowareContactId as string,
				status: "success",
			}),
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "Contact sync completed successfully",
		},
	],
};

/**
 * Get contact sync workflow by direction
 */
export function getContactSyncWorkflow(direction: "aloware_to_ghl" | "ghl_to_aloware"): WorkflowDefinition {
	return direction === "aloware_to_ghl"
		? contactSyncWorkflowAlowareToGHL
		: contactSyncWorkflowGHLToAloware;
}
