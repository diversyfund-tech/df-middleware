/**
 * Sales Workflow Implementation
 * 
 * Defines the sales agent workflow steps:
 * 1. Collect prospect information (name, phone, email, investment interest)
 * 2. Qualify leads based on criteria
 * 3. Book appointment (if qualified)
 * 4. Create contact in CRM
 * 5. Send confirmation message
 */

import type { WorkflowDefinition, WorkflowState, ToolExecutionResult } from "./types";

/**
 * Sales workflow definition
 */
export const salesWorkflow: WorkflowDefinition = {
	type: "sales",
	name: "Sales Agent Workflow",
	description: "Sales workflow for qualifying leads and booking appointments",
	initialStep: "collect_contact_info",
	steps: [
		{
			name: "collect_contact_info",
			type: "collect_info",
			description: "Collect prospect contact information (name, phone, email)",
			requiredData: [],
			nextStep: "collect_investment_interest",
		},
		{
			name: "collect_investment_interest",
			type: "collect_info",
			description: "Collect investment interest and qualification information",
			requiredData: ["firstName", "lastName", "phone"],
			nextStep: "qualify_lead",
		},
		{
			name: "qualify_lead",
			type: "decision",
			description: "Qualify lead based on collected criteria",
			requiredData: ["firstName", "lastName", "phone", "investmentInterest"],
			nextStep: (state: WorkflowState) => {
				// If qualified, proceed to book appointment, otherwise end
				const qualified = state.decisions.qualified === true;
				return qualified ? "create_contact" : "end_not_qualified";
			},
		},
		{
			name: "create_contact",
			type: "tool_call",
			description: "Create contact in CRM",
			requiredData: ["firstName", "lastName", "phone"],
			toolName: "comms_contacts_create",
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				// Extract contact ID from result if available
				const contactId = (result.data as { id?: string })?.id;
				return {
					...state,
					collectedData: {
						...state.collectedData,
						contactId,
					},
					metadata: {
						...state.metadata,
						contactId,
					},
				};
			},
			nextStep: "book_appointment",
		},
		{
			name: "book_appointment",
			type: "tool_call",
			description: "Book appointment using GHL calendar API",
			requiredData: ["firstName", "lastName", "phone", "contactId"],
			// Note: This will use GHL API directly, not MCP tool
			// The workflow engine will handle this specially
			nextStep: "send_confirmation",
		},
		{
			name: "send_confirmation",
			type: "tool_call",
			description: "Send confirmation message to prospect",
			requiredData: ["phone", "appointmentId"],
			toolName: "sms_sms_create",
			nextStep: "complete",
		},
		{
			name: "end_not_qualified",
			type: "complete",
			description: "End workflow - lead not qualified",
		},
		{
			name: "complete",
			type: "complete",
			description: "Workflow completed successfully",
		},
	],
};

/**
 * Get sales workflow definition
 */
export function getSalesWorkflow(): WorkflowDefinition {
	return salesWorkflow;
}

/**
 * Check if lead is qualified based on state
 * This is a helper function that can be used in decision steps
 */
export function isLeadQualified(state: WorkflowState): boolean {
	const investmentInterest = state.collectedData.investmentInterest;
	const hasInterest = investmentInterest && 
		(typeof investmentInterest === "string" ? investmentInterest.toLowerCase().includes("yes") || investmentInterest.toLowerCase().includes("interested") : false);
	
	// Add more qualification criteria as needed
	return hasInterest === true;
}
