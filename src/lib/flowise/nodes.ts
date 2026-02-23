/**
 * Flowise Node Definitions
 * 
 * Custom node definitions for Flowise visual workflow builder.
 * Each node maps to a workflow step type or middleware operation.
 */

import type { WorkflowStepDefinition } from "@/lib/workflows/types";

/**
 * Flowise node category
 */
export type FlowiseNodeCategory = 
	| "Sync"
	| "Voice Agent"
	| "API"
	| "Event"
	| "Data Transformation"
	| "Control Flow";

/**
 * Flowise node input/output schema
 */
export interface FlowiseNodeIO {
	name: string;
	type: "string" | "number" | "boolean" | "object" | "array";
	required?: boolean;
	description?: string;
	default?: unknown;
}

/**
 * Flowise node definition
 */
export interface FlowiseNodeDefinition {
	name: string;
	displayName: string;
	description: string;
	category: FlowiseNodeCategory;
	icon?: string;
	inputs: FlowiseNodeIO[];
	outputs: FlowiseNodeIO[];
	config?: Record<string, unknown>;
	workflowStepType?: string;
}

/**
 * Sync Nodes
 */
export const syncNodes: FlowiseNodeDefinition[] = [
	{
		name: "ContactSync",
		displayName: "Contact Sync",
		description: "Synchronize contact between Aloware and GHL",
		category: "Sync",
		icon: "👤",
		workflowStepType: "sync_contact",
		inputs: [
			{ name: "contactId", type: "string", required: true, description: "Contact ID from source system" },
			{ name: "source", type: "string", required: true, description: "Source system (aloware|ghl)", default: "aloware" },
			{ name: "target", type: "string", required: true, description: "Target system (aloware|ghl)", default: "ghl" },
			{ name: "direction", type: "string", description: "Sync direction (aloware_to_ghl|ghl_to_aloware)" },
			{ name: "conflictResolution", type: "string", description: "Conflict resolution strategy", default: "source_wins" },
		],
		outputs: [
			{ name: "targetContactId", type: "string", description: "Contact ID in target system" },
			{ name: "mappingId", type: "string", description: "Contact mapping ID" },
			{ name: "status", type: "string", description: "Sync status" },
		],
	},
	{
		name: "CallSync",
		displayName: "Call Sync",
		description: "Synchronize call data from Aloware to GHL",
		category: "Sync",
		icon: "📞",
		workflowStepType: "sync_call",
		inputs: [
			{ name: "callId", type: "string", required: true, description: "Call ID from Aloware" },
			{ name: "contactId", type: "string", required: true, description: "Contact ID associated with call" },
		],
		outputs: [
			{ name: "ghlContactId", type: "string", description: "GHL contact ID" },
			{ name: "status", type: "string", description: "Sync status" },
		],
	},
	{
		name: "MessageSync",
		displayName: "Message Sync",
		description: "Synchronize message between Texting system and GHL/Aloware",
		category: "Sync",
		icon: "💬",
		workflowStepType: "sync_message",
		inputs: [
			{ name: "messageId", type: "string", required: true, description: "Message ID from source system" },
			{ name: "target", type: "string", required: true, description: "Target system (ghl|aloware)", default: "ghl" },
			{ name: "messageData", type: "object", description: "Full message payload" },
		],
		outputs: [
			{ name: "conversationId", type: "string", description: "Conversation ID in target system" },
			{ name: "status", type: "string", description: "Sync status" },
		],
	},
	{
		name: "ListSync",
		displayName: "List Sync",
		description: "Synchronize GHL tag to Aloware call list",
		category: "Sync",
		icon: "📋",
		workflowStepType: "sync_list",
		inputs: [
			{ name: "tagName", type: "string", required: true, description: "GHL tag name" },
		],
		outputs: [
			{ name: "listId", type: "string", description: "Aloware call list ID" },
			{ name: "status", type: "string", description: "Sync status" },
		],
	},
	{
		name: "DNCSync",
		displayName: "DNC Sync",
		description: "Synchronize Do Not Call status",
		category: "Sync",
		icon: "🚫",
		workflowStepType: "sync_dnc",
		inputs: [
			{ name: "contactId", type: "string", required: true, description: "Contact ID" },
			{ name: "payload", type: "object", description: "DNC event payload" },
		],
		outputs: [
			{ name: "status", type: "string", description: "Sync status" },
		],
	},
];

/**
 * Voice Agent Nodes
 */
export const voiceAgentNodes: FlowiseNodeDefinition[] = [
	{
		name: "CollectInfo",
		displayName: "Collect Info",
		description: "Collect information from user during conversation",
		category: "Voice Agent",
		icon: "📝",
		workflowStepType: "collect_info",
		inputs: [
			{ name: "fields", type: "array", required: true, description: "Fields to collect" },
			{ name: "prompt", type: "string", description: "Prompt to ask user" },
		],
		outputs: [
			{ name: "collectedData", type: "object", description: "Collected data" },
		],
	},
	{
		name: "ToolCall",
		displayName: "Tool Call",
		description: "Execute an MCP tool",
		category: "Voice Agent",
		icon: "🔧",
		workflowStepType: "tool_call",
		inputs: [
			{ name: "toolName", type: "string", required: true, description: "MCP tool name" },
			{ name: "toolArgs", type: "object", description: "Tool arguments" },
		],
		outputs: [
			{ name: "result", type: "object", description: "Tool execution result" },
			{ name: "success", type: "boolean", description: "Whether tool call succeeded" },
		],
	},
	{
		name: "Decision",
		displayName: "Decision",
		description: "Branch workflow based on conditions",
		category: "Voice Agent",
		icon: "❓",
		workflowStepType: "decision",
		inputs: [
			{ name: "condition", type: "string", required: true, description: "Condition to evaluate" },
			{ name: "trueStep", type: "string", description: "Step if condition is true" },
			{ name: "falseStep", type: "string", description: "Step if condition is false" },
		],
		outputs: [
			{ name: "decision", type: "boolean", description: "Decision result" },
			{ name: "nextStep", type: "string", description: "Next step name" },
		],
	},
	{
		name: "Complete",
		displayName: "Complete",
		description: "Mark workflow as complete",
		category: "Voice Agent",
		icon: "✅",
		workflowStepType: "complete",
		inputs: [],
		outputs: [
			{ name: "status", type: "string", description: "Completion status" },
		],
	},
];

/**
 * API Nodes - Dynamically generated from MCP tools
 * These will be populated from the MCP tool registry
 */
export const apiNodes: FlowiseNodeDefinition[] = [
	// Placeholder - will be populated dynamically
	{
		name: "GHLAPICall",
		displayName: "GHL API Call",
		description: "Call GoHighLevel API endpoint",
		category: "API",
		icon: "🔌",
		inputs: [
			{ name: "endpoint", type: "string", required: true, description: "API endpoint path" },
			{ name: "method", type: "string", required: true, description: "HTTP method", default: "GET" },
			{ name: "body", type: "object", description: "Request body" },
		],
		outputs: [
			{ name: "response", type: "object", description: "API response" },
		],
	},
	{
		name: "AlowareAPICall",
		displayName: "Aloware API Call",
		description: "Call Aloware API endpoint",
		category: "API",
		icon: "🔌",
		inputs: [
			{ name: "endpoint", type: "string", required: true, description: "API endpoint path" },
			{ name: "method", type: "string", required: true, description: "HTTP method", default: "GET" },
			{ name: "body", type: "object", description: "Request body" },
		],
		outputs: [
			{ name: "response", type: "object", description: "API response" },
		],
	},
	{
		name: "VerityAPICall",
		displayName: "Verity API Call",
		description: "Call Verity API endpoint via MCP",
		category: "API",
		icon: "🔌",
		inputs: [
			{ name: "toolName", type: "string", required: true, description: "MCP tool name" },
			{ name: "toolArgs", type: "object", description: "Tool arguments" },
		],
		outputs: [
			{ name: "result", type: "object", description: "API response" },
		],
	},
];

/**
 * Event Nodes
 */
export const eventNodes: FlowiseNodeDefinition[] = [
	{
		name: "RouteEvent",
		displayName: "Route Event",
		description: "Route webhook event to appropriate handler",
		category: "Event",
		icon: "🔄",
		workflowStepType: "route_event",
		inputs: [
			{ name: "eventType", type: "string", required: true, description: "Event type" },
			{ name: "source", type: "string", required: true, description: "Event source (ghl|aloware|texting)" },
			{ name: "payload", type: "object", required: true, description: "Event payload" },
		],
		outputs: [
			{ name: "routed", type: "boolean", description: "Whether event was routed" },
			{ name: "handler", type: "string", description: "Handler that processed event" },
		],
	},
	{
		name: "ResolveAgent",
		displayName: "Resolve Agent",
		description: "Resolve agent for contact or event",
		category: "Event",
		icon: "🤖",
		workflowStepType: "resolve_agent",
		inputs: [
			{ name: "contactId", type: "string", description: "Contact ID" },
			{ name: "phoneNumber", type: "string", description: "Phone number" },
			{ name: "email", type: "string", description: "Email address" },
		],
		outputs: [
			{ name: "agentId", type: "string", description: "Resolved agent ID" },
		],
	},
	{
		name: "ApplyListMembership",
		displayName: "Apply List Membership",
		description: "Apply list membership changes",
		category: "Event",
		icon: "📋",
		workflowStepType: "apply_list_membership",
		inputs: [
			{ name: "contactId", type: "string", required: true, description: "Contact ID" },
			{ name: "listId", type: "string", required: true, description: "List ID" },
			{ name: "action", type: "string", required: true, description: "Action (add|remove)", default: "add" },
		],
		outputs: [
			{ name: "success", type: "boolean", description: "Whether operation succeeded" },
		],
	},
];

/**
 * Data Transformation Nodes
 */
export const dataTransformationNodes: FlowiseNodeDefinition[] = [
	{
		name: "ContactMapper",
		displayName: "Contact Mapper",
		description: "Map contact data between systems",
		category: "Data Transformation",
		icon: "🔄",
		inputs: [
			{ name: "sourceContact", type: "object", required: true, description: "Source contact data" },
			{ name: "sourceSystem", type: "string", required: true, description: "Source system" },
			{ name: "targetSystem", type: "string", required: true, description: "Target system" },
		],
		outputs: [
			{ name: "targetContact", type: "object", description: "Mapped contact data" },
		],
	},
	{
		name: "DataTransformer",
		displayName: "Data Transformer",
		description: "Transform data using custom logic",
		category: "Data Transformation",
		icon: "⚙️",
		inputs: [
			{ name: "data", type: "object", required: true, description: "Input data" },
			{ name: "transformation", type: "string", description: "Transformation script or function" },
		],
		outputs: [
			{ name: "transformedData", type: "object", description: "Transformed data" },
		],
	},
	{
		name: "ConflictResolver",
		displayName: "Conflict Resolver",
		description: "Resolve conflicts between data sources",
		category: "Data Transformation",
		icon: "⚖️",
		inputs: [
			{ name: "sourceData", type: "object", required: true, description: "Source data" },
			{ name: "targetData", type: "object", required: true, description: "Target data" },
			{ name: "strategy", type: "string", description: "Conflict resolution strategy", default: "source_wins" },
		],
		outputs: [
			{ name: "resolvedData", type: "object", description: "Resolved data" },
		],
	},
];

/**
 * Control Flow Nodes
 */
export const controlFlowNodes: FlowiseNodeDefinition[] = [
	{
		name: "ConditionalBranch",
		displayName: "Conditional Branch",
		description: "Branch workflow based on condition",
		category: "Control Flow",
		icon: "🔀",
		inputs: [
			{ name: "condition", type: "string", required: true, description: "Condition expression" },
			{ name: "trueOutput", type: "string", description: "Output if true" },
			{ name: "falseOutput", type: "string", description: "Output if false" },
		],
		outputs: [
			{ name: "result", type: "boolean", description: "Condition result" },
			{ name: "output", type: "string", description: "Selected output" },
		],
	},
	{
		name: "RetryLogic",
		displayName: "Retry Logic",
		description: "Retry operation with exponential backoff",
		category: "Control Flow",
		icon: "🔄",
		inputs: [
			{ name: "operation", type: "string", required: true, description: "Operation to retry" },
			{ name: "maxRetries", type: "number", description: "Maximum retry attempts", default: 3 },
			{ name: "delay", type: "number", description: "Initial delay in milliseconds", default: 1000 },
		],
		outputs: [
			{ name: "success", type: "boolean", description: "Whether operation succeeded" },
			{ name: "attempts", type: "number", description: "Number of attempts made" },
		],
	},
	{
		name: "ErrorHandler",
		displayName: "Error Handler",
		description: "Handle errors and route to recovery path",
		category: "Control Flow",
		icon: "⚠️",
		inputs: [
			{ name: "error", type: "object", required: true, description: "Error object" },
			{ name: "recoveryStep", type: "string", description: "Step to execute on error" },
		],
		outputs: [
			{ name: "handled", type: "boolean", description: "Whether error was handled" },
			{ name: "recoveryResult", type: "object", description: "Recovery operation result" },
		],
	},
];

/**
 * Get all Flowise node definitions
 */
export function getAllFlowiseNodes(): FlowiseNodeDefinition[] {
	return [
		...syncNodes,
		...voiceAgentNodes,
		...apiNodes,
		...eventNodes,
		...dataTransformationNodes,
		...controlFlowNodes,
	];
}

/**
 * Get nodes by category
 */
export function getFlowiseNodesByCategory(category: FlowiseNodeCategory): FlowiseNodeDefinition[] {
	return getAllFlowiseNodes().filter(node => node.category === category);
}

/**
 * Get node by name
 */
export function getFlowiseNodeByName(name: string): FlowiseNodeDefinition | undefined {
	return getAllFlowiseNodes().find(node => node.name === name);
}
