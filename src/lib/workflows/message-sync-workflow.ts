/**
 * Message Sync Workflow Implementation
 * 
 * Defines the message synchronization workflow steps:
 * 1. Fetch message data from source system
 * 2. Find or create conversation in target system
 * 3. Sync message to target system
 * 4. Update conversation thread
 * 5. Log sync operation
 */

import type { WorkflowDefinition, WorkflowState, ToolExecutionResult } from "./types";

/**
 * Message sync workflow definition (Texting → GHL)
 */
export const messageSyncWorkflowTextingToGHL: WorkflowDefinition = {
	type: "sync",
	name: "Message Sync Workflow (Texting → GHL)",
	description: "Synchronizes message from Texting system to GoHighLevel",
	initialStep: "fetch_message_data",
	steps: [
		{
			name: "fetch_message_data",
			type: "tool_call",
			description: "Fetch message data from Texting system",
			requiredData: ["messageId"],
			toolName: "texting_messages_get",
			toolArgs: (state: WorkflowState) => ({
				id: state.collectedData.messageId as string,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						messageData: result.data,
					},
				};
			},
			nextStep: "find_or_create_conversation",
		},
		{
			name: "find_or_create_conversation",
			type: "tool_call",
			description: "Find or create conversation in GHL",
			requiredData: ["messageData"],
			toolName: "ghl_conversations_search",
			toolArgs: (state: WorkflowState) => {
				const messageData = state.collectedData.messageData as { to?: string; from?: string };
				return {
					phoneNumber: messageData.to || messageData.from,
				};
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						conversationId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: (state: WorkflowState) => {
				const conversationId = state.collectedData.conversationId;
				return conversationId ? "sync_message" : "create_conversation";
			},
		},
		{
			name: "create_conversation",
			type: "tool_call",
			description: "Create new conversation in GHL",
			requiredData: ["messageData"],
			toolName: "ghl_conversations_create",
			toolArgs: (state: WorkflowState) => {
				const messageData = state.collectedData.messageData as { to?: string; from?: string; body?: string };
				return {
					body: {
						phoneNumber: messageData.to || messageData.from,
						message: messageData.body,
					},
				};
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						conversationId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "sync_message",
		},
		{
			name: "sync_message",
			type: "sync_message",
			description: "Sync message to GHL conversation",
			requiredData: ["conversationId", "messageData"],
			syncConfig: {
				source: "texting",
				target: "ghl",
				direction: "aloware_to_ghl", // Using existing direction enum
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						ghlMessageId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "log_sync",
		},
		{
			name: "log_sync",
			type: "tool_call",
			description: "Log sync operation",
			requiredData: ["messageId", "conversationId"],
			toolName: "log_sync_operation",
			toolArgs: (state: WorkflowState) => ({
				direction: "aloware_to_ghl",
				entityType: "message",
				entityId: state.collectedData.messageId as string,
				sourceId: state.collectedData.messageId as string,
				targetId: state.collectedData.conversationId as string,
				status: "success",
			}),
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "Message sync completed successfully",
		},
	],
};

/**
 * Message sync workflow definition (Texting → Aloware)
 */
export const messageSyncWorkflowTextingToAloware: WorkflowDefinition = {
	type: "sync",
	name: "Message Sync Workflow (Texting → Aloware)",
	description: "Synchronizes message from Texting system to Aloware",
	initialStep: "fetch_message_data",
	steps: [
		{
			name: "fetch_message_data",
			type: "tool_call",
			description: "Fetch message data from Texting system",
			requiredData: ["messageId"],
			toolName: "texting_messages_get",
			toolArgs: (state: WorkflowState) => ({
				id: state.collectedData.messageId as string,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						messageData: result.data,
					},
				};
			},
			nextStep: "sync_message",
		},
		{
			name: "sync_message",
			type: "sync_message",
			description: "Sync message to Aloware",
			requiredData: ["messageData"],
			syncConfig: {
				source: "texting",
				target: "aloware",
				direction: "aloware_to_ghl", // Using existing direction enum
			},
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						alowareMessageId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "log_sync",
		},
		{
			name: "log_sync",
			type: "tool_call",
			description: "Log sync operation",
			requiredData: ["messageId"],
			toolName: "log_sync_operation",
			toolArgs: (state: WorkflowState) => ({
				direction: "aloware_to_ghl",
				entityType: "message",
				entityId: state.collectedData.messageId as string,
				sourceId: state.collectedData.messageId as string,
				targetId: state.collectedData.alowareMessageId as string,
				status: "success",
			}),
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "Message sync completed successfully",
		},
	],
};

/**
 * Get message sync workflow by target
 */
export function getMessageSyncWorkflow(target: "ghl" | "aloware"): WorkflowDefinition {
	return target === "ghl"
		? messageSyncWorkflowTextingToGHL
		: messageSyncWorkflowTextingToAloware;
}
