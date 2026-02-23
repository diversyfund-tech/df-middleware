/**
 * Workflow-Specific Tool Configurations
 * 
 * Maps workflow steps to required MCP tools and provides
 * tool usage examples for prompt building.
 */

import type { MCPTool } from "@/mcp/tools/generator";

export type WorkflowType = "sales" | "support" | "appointment" | "custom";

/**
 * Tool usage examples for different workflow steps
 */
export const WORKFLOW_TOOL_EXAMPLES: Record<string, Record<string, string>> = {
	sales: {
		"collect_contact_info": `Use comms_contacts_create to create a contact:
{
  "body": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "email": "john@example.com"
  }
}`,
		"book_appointment": `Use GHL calendar API (not MCP) to book appointments. See ghl-appointment.ts for implementation.`,
		"send_confirmation": `Use sms_sms_create to send confirmation:
{
  "body": {
    "to": "+1234567890",
    "body": "Your appointment is confirmed for..."
  }
}`,
		"create_contact": `Use comms_contacts_create to create a contact in CRM.`,
	},
	support: {
		"create_ticket": `Use appropriate ticket creation tool if available.`,
		"send_response": `Use sms_sms_create or conversations messages create to send responses.`,
	},
	appointment: {
		"check_availability": `Use GHL calendar API to check availability.`,
		"book_appointment": `Use GHL calendar API to book appointments.`,
		"send_confirmation": `Use sms_sms_create to send confirmation messages.`,
	},
};

/**
 * Required tools for each workflow type
 */
export const WORKFLOW_REQUIRED_TOOLS: Record<WorkflowType, string[]> = {
	sales: [
		"comms_contacts_create", // Create prospect contact
		"sms_sms_create", // Send confirmation messages
		"conversations_messages_create", // Send follow-up messages
	],
	support: [
		"comms_contacts_create", // Create support contact
		"sms_sms_create", // Send responses
		"conversations_messages_create", // Handle conversations
	],
	appointment: [
		"comms_contacts_create", // Create contact if needed
		"sms_sms_create", // Send confirmation
	],
	custom: [], // No specific requirements
};

/**
 * Map workflow step names to tool names
 */
export function getToolForStep(workflowType: WorkflowType, stepName: string): string | null {
	const stepToTool: Record<string, Record<string, string>> = {
		sales: {
			create_contact: "comms_contacts_create",
			send_confirmation: "sms_sms_create",
			send_followup: "conversations_messages_create",
		},
		support: {
			create_contact: "comms_contacts_create",
			send_response: "sms_sms_create",
		},
		appointment: {
			create_contact: "comms_contacts_create",
			send_confirmation: "sms_sms_create",
		},
		custom: {},
	};

	return stepToTool[workflowType]?.[stepName] || null;
}

/**
 * Get tool usage example for a workflow step
 */
export function getToolExample(workflowType: WorkflowType, stepName: string): string | null {
	return WORKFLOW_TOOL_EXAMPLES[workflowType]?.[stepName] || null;
}

/**
 * Validate that required tools are available
 */
export async function validateWorkflowTools(
	workflowType: WorkflowType,
	availableTools: MCPTool[]
): Promise<{ valid: boolean; missing: string[] }> {
	const required = WORKFLOW_REQUIRED_TOOLS[workflowType] || [];
	const availableNames = new Set(availableTools.map(t => t.name));
	
	const missing = required.filter(toolName => !availableNames.has(toolName));
	
	return {
		valid: missing.length === 0,
		missing,
	};
}

/**
 * Get workflow-specific tool descriptions for prompts
 */
export function getWorkflowToolInstructions(workflowType: WorkflowType): string {
	const instructions: Record<WorkflowType, string> = {
		sales: `Available tools for sales workflow:
- comms_contacts_create: Create prospect contacts in CRM
- sms_sms_create: Send SMS confirmation messages
- conversations_messages_create: Send follow-up messages
- Note: Appointment booking uses GHL API directly (not MCP tools)`,
		support: `Available tools for support workflow:
- comms_contacts_create: Create support contacts
- sms_sms_create: Send SMS responses
- conversations_messages_create: Handle conversation threads`,
		appointment: `Available tools for appointment workflow:
- comms_contacts_create: Create contacts if needed
- sms_sms_create: Send appointment confirmations
- Note: Calendar and appointment operations use GHL API directly`,
		custom: `All MCP tools are available for custom workflows.`,
	};

	return instructions[workflowType] || instructions.custom;
}
