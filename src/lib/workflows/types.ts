/**
 * Workflow Types and Interfaces
 * 
 * Type definitions for workflow system, state management, and step execution.
 */

export type WorkflowType = "sales" | "support" | "appointment" | "sync" | "voice_agent" | "business_process" | "custom";

export type WorkflowStatus = "in_progress" | "completed" | "failed" | "abandoned";

export type StepType = 
	| "collect_info" 
	| "tool_call" 
	| "decision" 
	| "complete"
	| "sync_contact"
	| "sync_call"
	| "sync_message"
	| "sync_list"
	| "sync_dnc"
	| "route_event"
	| "resolve_agent"
	| "apply_list_membership";

export type StepStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Workflow state stored in database
 */
export interface WorkflowState {
	step: string; // Current step name
	collectedData: Record<string, unknown>; // Data collected during workflow
	decisions: Record<string, boolean>; // Decision points and their outcomes
	metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
	success: boolean;
	data?: unknown;
	error?: string;
}

/**
 * Workflow step result
 */
export interface StepResult {
	stepName: string;
	status: StepStatus;
	toolCalled?: string;
	toolResult?: ToolExecutionResult;
	collectedData?: Record<string, unknown>;
	error?: string;
	nextStep?: string; // Next step to execute
}

/**
 * Workflow execution metadata
 */
export interface WorkflowMetadata {
	callId?: string; // ElevenLabs call ID
	phoneNumber?: string; // Phone number called
	contactId?: string; // Contact ID if created
	appointmentId?: string; // Appointment ID if booked
	[key: string]: unknown;
}

/**
 * Sync operation configuration
 */
export interface SyncConfig {
	source?: "aloware" | "ghl" | "texting" | "verity";
	target?: "aloware" | "ghl" | "texting" | "verity";
	direction?: "aloware_to_ghl" | "ghl_to_aloware" | "bidirectional";
	conflictResolution?: "source_wins" | "target_wins" | "merge" | "manual";
	retryCount?: number;
	retryDelay?: number; // milliseconds
}

/**
 * Workflow step definition
 */
export interface WorkflowStepDefinition {
	name: string;
	type: StepType;
	description: string;
	requiredData?: string[]; // Required data fields before this step can execute
	toolName?: string; // MCP tool name if this step calls a tool
	syncConfig?: SyncConfig; // Configuration for sync operations
	nextStep?: string | ((state: WorkflowState) => string); // Next step or function to determine next step
	onSuccess?: (state: WorkflowState, result: ToolExecutionResult) => WorkflowState; // State transformation on success
	onFailure?: (state: WorkflowState, error: string) => WorkflowState; // State transformation on failure
	toolArgs?: (state: WorkflowState) => Record<string, unknown>; // Function to generate tool arguments from state
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
	type: WorkflowType;
	name: string;
	description: string;
	steps: WorkflowStepDefinition[];
	initialStep: string;
}

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
	executionId: string;
	agentId: string;
	workflowType: WorkflowType;
	state: WorkflowState;
	metadata: WorkflowMetadata;
	startedAt: Date;
}
