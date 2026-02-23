/**
 * Support Workflow Implementation
 * 
 * Defines the support agent workflow steps:
 * 1. Collect customer information (name, phone, issue description)
 * 2. Categorize issue
 * 3. Route to appropriate support channel
 * 4. Create ticket/contact in CRM
 * 5. Send confirmation message
 */

import type { WorkflowDefinition, WorkflowState, ToolExecutionResult } from "./types";

/**
 * Support workflow definition
 */
export const supportWorkflow: WorkflowDefinition = {
	type: "support",
	name: "Support Agent Workflow",
	description: "Support workflow for handling customer issues and routing to appropriate channels",
	initialStep: "collect_customer_info",
	steps: [
		{
			name: "collect_customer_info",
			type: "collect_info",
			description: "Collect customer contact information (name, phone, email)",
			requiredData: [],
			nextStep: "collect_issue_description",
		},
		{
			name: "collect_issue_description",
			type: "collect_info",
			description: "Collect issue description and category",
			requiredData: ["firstName", "lastName", "phone"],
			nextStep: "categorize_issue",
		},
		{
			name: "categorize_issue",
			type: "decision",
			description: "Categorize issue and determine routing",
			requiredData: ["firstName", "lastName", "phone", "issueDescription"],
			nextStep: (state: WorkflowState) => {
				// Route based on issue category
				const category = state.decisions.issueCategory as string;
				if (category === "technical") {
					return "route_to_technical_support";
				} else if (category === "billing") {
					return "route_to_billing";
				} else if (category === "general") {
					return "create_support_ticket";
				}
				return "end_no_category";
			},
		},
		{
			name: "route_to_technical_support",
			type: "tool_call",
			description: "Route to technical support team",
			requiredData: ["firstName", "lastName", "phone", "issueDescription"],
			nextStep: "create_support_ticket",
			toolName: "create_support_ticket",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.data.contactId as string,
				category: "technical",
				description: state.data.issueDescription as string,
			}),
		},
		{
			name: "route_to_billing",
			type: "tool_call",
			description: "Route to billing support team",
			requiredData: ["firstName", "lastName", "phone", "issueDescription"],
			nextStep: "create_support_ticket",
			toolName: "create_support_ticket",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.data.contactId as string,
				category: "billing",
				description: state.data.issueDescription as string,
			}),
		},
		{
			name: "create_support_ticket",
			type: "tool_call",
			description: "Create support ticket in CRM",
			requiredData: ["firstName", "lastName", "phone", "issueDescription"],
			nextStep: "send_confirmation",
			toolName: "create_contact",
			toolArgs: (state: WorkflowState) => ({
				firstName: state.data.firstName as string,
				lastName: state.data.lastName as string,
				phone: state.data.phone as string,
				email: state.data.email as string,
			}),
		},
		{
			name: "send_confirmation",
			type: "tool_call",
			description: "Send confirmation message to customer",
			requiredData: ["contactId"],
			nextStep: "end",
			toolName: "send_message",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.data.contactId as string,
				message: "Thank you for contacting support. We have received your request and will get back to you shortly.",
			}),
		},
		{
			name: "end",
			type: "end",
			description: "Workflow completed",
			requiredData: [],
		},
		{
			name: "end_no_category",
			type: "end",
			description: "Workflow ended - no category determined",
			requiredData: [],
		},
	],
};

/**
 * Get support workflow definition
 */
export function getSupportWorkflow(): WorkflowDefinition {
	return supportWorkflow;
}
