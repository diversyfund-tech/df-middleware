/**
 * Business Process Workflows
 * 
 * High-level business process workflows that orchestrate
 * multiple steps across different systems.
 */

import type { WorkflowDefinition, WorkflowState, ToolExecutionResult } from "./types";

/**
 * Lead Qualification Process
 * 
 * Collects prospect information, qualifies leads, routes to sales/support,
 * creates contact, and books appointment if qualified.
 */
export const leadQualificationWorkflow: WorkflowDefinition = {
	type: "business_process",
	name: "Lead Qualification Process",
	description: "Qualify leads and route to appropriate team",
	initialStep: "collect_prospect_info",
	steps: [
		{
			name: "collect_prospect_info",
			type: "collect_info",
			description: "Collect prospect contact information",
			requiredData: [],
			nextStep: "collect_qualification_data",
		},
		{
			name: "collect_qualification_data",
			type: "collect_info",
			description: "Collect investment interest and qualification criteria",
			requiredData: ["firstName", "lastName", "phone"],
			nextStep: "qualify_lead",
		},
		{
			name: "qualify_lead",
			type: "decision",
			description: "Qualify lead based on collected criteria",
			requiredData: ["firstName", "lastName", "phone", "investmentInterest"],
			nextStep: (state: WorkflowState) => {
				const qualified = state.decisions.qualified === true;
				return qualified ? "route_to_sales" : "route_to_support";
			},
		},
		{
			name: "route_to_sales",
			type: "tool_call",
			description: "Route qualified lead to sales team",
			requiredData: ["firstName", "lastName", "phone"],
			toolName: "comms_contacts_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					firstName: state.collectedData.firstName,
					lastName: state.collectedData.lastName,
					phone: state.collectedData.phone,
					email: state.collectedData.email,
					tags: ["Qualified Lead", "Sales"],
				},
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						contactId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "book_appointment",
		},
		{
			name: "route_to_support",
			type: "tool_call",
			description: "Route unqualified lead to support for nurturing",
			requiredData: ["firstName", "lastName", "phone"],
			toolName: "comms_contacts_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					firstName: state.collectedData.firstName,
					lastName: state.collectedData.lastName,
					phone: state.collectedData.phone,
					email: state.collectedData.email,
					tags: ["Unqualified Lead", "Support"],
				},
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						contactId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "send_nurture_message",
		},
		{
			name: "book_appointment",
			type: "tool_call",
			description: "Book appointment for qualified lead",
			requiredData: ["contactId"],
			toolName: "calendars_events_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					contactId: state.collectedData.contactId,
					title: "Sales Consultation",
					date: state.collectedData.preferredDate,
				},
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						appointmentId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "send_confirmation",
		},
		{
			name: "send_nurture_message",
			type: "tool_call",
			description: "Send nurturing message to unqualified lead",
			requiredData: ["contactId"],
			toolName: "sms_sms_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					to: state.collectedData.phone as string,
					body: "Thank you for your interest! We'll keep you updated with relevant information.",
				},
			}),
			nextStep: "complete",
		},
		{
			name: "send_confirmation",
			type: "tool_call",
			description: "Send appointment confirmation",
			requiredData: ["contactId", "appointmentId"],
			toolName: "sms_sms_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					to: state.collectedData.phone as string,
					body: `Your appointment has been confirmed for ${state.collectedData.preferredDate}. We look forward to speaking with you!`,
				},
			}),
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "Lead qualification process completed",
		},
	],
};

/**
 * Onboarding Process
 * 
 * Creates contact, assigns agent, adds to list, sends welcome message,
 * and schedules follow-up.
 */
export const onboardingWorkflow: WorkflowDefinition = {
	type: "business_process",
	name: "Onboarding Process",
	description: "Onboard new contact with agent assignment and welcome flow",
	initialStep: "create_contact",
	steps: [
		{
			name: "create_contact",
			type: "tool_call",
			description: "Create contact in CRM",
			requiredData: ["firstName", "lastName", "phone"],
			toolName: "comms_contacts_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					firstName: state.collectedData.firstName,
					lastName: state.collectedData.lastName,
					phone: state.collectedData.phone,
					email: state.collectedData.email,
				},
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						contactId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "assign_agent",
		},
		{
			name: "assign_agent",
			type: "resolve_agent",
			description: "Resolve and assign agent to contact",
			requiredData: ["contactId"],
			toolName: "resolve_agent_for_contact",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.collectedData.contactId,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						agentId: (result.data as { agentId?: string })?.agentId,
					},
				};
			},
			nextStep: "add_to_list",
		},
		{
			name: "add_to_list",
			type: "apply_list_membership",
			description: "Add contact to onboarding list",
			requiredData: ["contactId"],
			toolName: "aloware_lists_add_contact",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.collectedData.contactId,
				listId: state.collectedData.onboardingListId || "default-onboarding-list",
			}),
			nextStep: "send_welcome_message",
		},
		{
			name: "send_welcome_message",
			type: "tool_call",
			description: "Send welcome message to new contact",
			requiredData: ["contactId"],
			toolName: "sms_sms_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					to: state.collectedData.phone as string,
					body: "Welcome! We're excited to have you on board. Our team will be in touch soon.",
				},
			}),
			nextStep: "schedule_followup",
		},
		{
			name: "schedule_followup",
			type: "tool_call",
			description: "Schedule follow-up task",
			requiredData: ["contactId", "agentId"],
			toolName: "calendars_events_create",
			toolArgs: (state: WorkflowState) => {
				const followupDate = new Date();
				followupDate.setDate(followupDate.getDate() + 3); // 3 days from now
				
				return {
					body: {
						contactId: state.collectedData.contactId,
						title: "Follow-up: Onboarding Check-in",
						date: followupDate.toISOString(),
						assignedTo: state.collectedData.agentId,
					},
				};
			},
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "Onboarding process completed",
		},
	],
};

/**
 * Support Ticket Process
 * 
 * Collects issue, categorizes, routes to appropriate channel,
 * creates ticket, notifies agent, and schedules follow-up.
 */
export const supportTicketWorkflow: WorkflowDefinition = {
	type: "business_process",
	name: "Support Ticket Process",
	description: "Handle customer support issues and create tickets",
	initialStep: "collect_customer_info",
	steps: [
		{
			name: "collect_customer_info",
			type: "collect_info",
			description: "Collect customer contact information",
			requiredData: [],
			nextStep: "collect_issue_description",
		},
		{
			name: "collect_issue_description",
			type: "collect_info",
			description: "Collect issue description and details",
			requiredData: ["firstName", "lastName", "phone"],
			nextStep: "categorize_issue",
		},
		{
			name: "categorize_issue",
			type: "decision",
			description: "Categorize issue and determine routing",
			requiredData: ["firstName", "lastName", "phone", "issueDescription"],
			nextStep: (state: WorkflowState) => {
				const category = state.decisions.issueCategory as string;
				if (category === "technical") {
					return "route_to_technical_support";
				} else if (category === "billing") {
					return "route_to_billing";
				} else {
					return "create_support_ticket";
				}
			},
		},
		{
			name: "route_to_technical_support",
			type: "tool_call",
			description: "Route to technical support team",
			requiredData: ["contactId", "issueDescription"],
			toolName: "comms_contacts_patch",
			toolArgs: (state: WorkflowState) => ({
				id: state.collectedData.contactId,
				body: {
					tags: ["Technical Support", "Priority"],
				},
			}),
			nextStep: "create_support_ticket",
		},
		{
			name: "route_to_billing",
			type: "tool_call",
			description: "Route to billing team",
			requiredData: ["contactId", "issueDescription"],
			toolName: "comms_contacts_patch",
			toolArgs: (state: WorkflowState) => ({
				id: state.collectedData.contactId,
				body: {
					tags: ["Billing", "Priority"],
				},
			}),
			nextStep: "create_support_ticket",
		},
		{
			name: "create_support_ticket",
			type: "tool_call",
			description: "Create support ticket in CRM",
			requiredData: ["contactId", "issueDescription"],
			toolName: "ghl_opportunities_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					name: `Support Ticket: ${state.collectedData.issueDescription}`,
					contactId: state.collectedData.contactId,
					status: "open",
					notes: state.collectedData.issueDescription as string,
				},
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						ticketId: (result.data as { id?: string })?.id,
					},
				};
			},
			nextStep: "notify_agent",
		},
		{
			name: "notify_agent",
			type: "tool_call",
			description: "Notify assigned agent about new ticket",
			requiredData: ["ticketId", "agentId"],
			toolName: "sms_sms_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					to: state.collectedData.agentPhone as string,
					body: `New support ticket created: ${state.collectedData.issueDescription}`,
				},
			}),
			nextStep: "send_confirmation",
		},
		{
			name: "send_confirmation",
			type: "tool_call",
			description: "Send confirmation to customer",
			requiredData: ["contactId", "ticketId"],
			toolName: "sms_sms_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					to: state.collectedData.phone as string,
					body: "We've received your support request and will get back to you shortly. Ticket ID: " + state.collectedData.ticketId,
				},
			}),
			nextStep: "schedule_followup",
		},
		{
			name: "schedule_followup",
			type: "tool_call",
			description: "Schedule follow-up task",
			requiredData: ["ticketId"],
			toolName: "calendars_events_create",
			toolArgs: (state: WorkflowState) => {
				const followupDate = new Date();
				followupDate.setHours(followupDate.getHours() + 24); // 24 hours from now
				
				return {
					body: {
						contactId: state.collectedData.contactId,
						title: "Follow-up: Support Ticket",
						date: followupDate.toISOString(),
					},
				};
			},
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "Support ticket process completed",
		},
	],
};

/**
 * Reassignment Process
 * 
 * Detects reassignment, updates mappings, notifies systems,
 * and updates lists.
 */
export const reassignmentWorkflow: WorkflowDefinition = {
	type: "business_process",
	name: "Reassignment Process",
	description: "Handle contact reassignment between agents",
	initialStep: "detect_reassignment",
	steps: [
		{
			name: "detect_reassignment",
			type: "tool_call",
			description: "Detect if contact has been reassigned",
			requiredData: ["contactId"],
			toolName: "detect_contact_reassignment",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.collectedData.contactId,
			}),
			onSuccess: (state: WorkflowState, result: ToolExecutionResult) => {
				return {
					...state,
					collectedData: {
						...state.collectedData,
						reassignmentDetected: (result.data as { reassigned?: boolean })?.reassigned,
						oldAgentId: (result.data as { oldAgentId?: string })?.oldAgentId,
						newAgentId: (result.data as { newAgentId?: string })?.newAgentId,
					},
				};
			},
			nextStep: (state: WorkflowState) => {
				const reassigned = state.collectedData.reassignmentDetected === true;
				return reassigned ? "update_mappings" : "complete";
			},
		},
		{
			name: "update_mappings",
			type: "tool_call",
			description: "Update contact mappings with new agent",
			requiredData: ["contactId", "newAgentId"],
			toolName: "update_contact_agent_mapping",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.collectedData.contactId,
				agentId: state.collectedData.newAgentId,
			}),
			nextStep: "notify_systems",
		},
		{
			name: "notify_systems",
			type: "tool_call",
			description: "Notify GHL and Aloware about reassignment",
			requiredData: ["contactId", "newAgentId"],
			toolName: "notify_systems_reassignment",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.collectedData.contactId,
				oldAgentId: state.collectedData.oldAgentId,
				newAgentId: state.collectedData.newAgentId,
			}),
			nextStep: "update_lists",
		},
		{
			name: "update_lists",
			type: "apply_list_membership",
			description: "Update list memberships for reassigned contact",
			requiredData: ["contactId", "oldAgentId", "newAgentId"],
			toolName: "update_contact_lists",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.collectedData.contactId,
				removeFromLists: [`agent-${state.collectedData.oldAgentId}-list`],
				addToList: [`agent-${state.collectedData.newAgentId}-list`],
			}),
			nextStep: "send_notification",
		},
		{
			name: "send_notification",
			type: "tool_call",
			description: "Send notification to new agent",
			requiredData: ["newAgentId", "contactId"],
			toolName: "sms_sms_create",
			toolArgs: (state: WorkflowState) => ({
				body: {
					to: state.collectedData.newAgentPhone as string,
					body: `You have been assigned a new contact. Contact ID: ${state.collectedData.contactId}`,
				},
			}),
			nextStep: "complete",
		},
		{
			name: "complete",
			type: "complete",
			description: "Reassignment process completed",
		},
	],
};

/**
 * Get business process workflow by name
 */
export function getBusinessProcessWorkflow(name: string): WorkflowDefinition | null {
	switch (name) {
		case "lead_qualification":
			return leadQualificationWorkflow;
		case "onboarding":
			return onboardingWorkflow;
		case "support_ticket":
			return supportTicketWorkflow;
		case "reassignment":
			return reassignmentWorkflow;
		default:
			return null;
	}
}

/**
 * List all business process workflows
 */
export function listBusinessProcessWorkflows(): Array<{ name: string; displayName: string; description: string }> {
	return [
		{ name: "lead_qualification", displayName: "Lead Qualification", description: "Qualify leads and route to appropriate team" },
		{ name: "onboarding", displayName: "Onboarding", description: "Onboard new contact with agent assignment" },
		{ name: "support_ticket", displayName: "Support Ticket", description: "Handle customer support issues" },
		{ name: "reassignment", displayName: "Reassignment", description: "Handle contact reassignment between agents" },
	];
}
