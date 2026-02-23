/**
 * Appointment Workflow Implementation
 * 
 * Defines the appointment booking workflow steps:
 * 1. Collect customer information (name, phone, email)
 * 2. Determine appointment type and preferences
 * 3. Check availability
 * 4. Book appointment
 * 5. Send confirmation message
 */

import type { WorkflowDefinition, WorkflowState, ToolExecutionResult } from "./types";

/**
 * Appointment workflow definition
 */
export const appointmentWorkflow: WorkflowDefinition = {
	type: "appointment",
	name: "Appointment Booking Workflow",
	description: "Workflow for booking appointments and managing calendar",
	initialStep: "collect_customer_info",
	steps: [
		{
			name: "collect_customer_info",
			type: "collect_info",
			description: "Collect customer contact information (name, phone, email)",
			requiredData: [],
			nextStep: "determine_appointment_type",
		},
		{
			name: "determine_appointment_type",
			type: "collect_info",
			description: "Determine appointment type and preferences",
			requiredData: ["firstName", "lastName", "phone"],
			nextStep: "check_availability",
		},
		{
			name: "check_availability",
			type: "tool_call",
			description: "Check available appointment slots",
			requiredData: ["firstName", "lastName", "phone", "appointmentType"],
			nextStep: "book_appointment",
			toolName: "get_available_slots",
			toolArgs: (state: WorkflowState) => ({
				appointmentType: state.data.appointmentType as string,
				date: state.data.preferredDate as string,
			}),
		},
		{
			name: "book_appointment",
			type: "tool_call",
			description: "Book the appointment",
			requiredData: ["contactId", "appointmentSlot"],
			nextStep: "create_contact_if_needed",
			toolName: "book_appointment",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.data.contactId as string,
				appointmentSlot: state.data.appointmentSlot as string,
				appointmentType: state.data.appointmentType as string,
			}),
		},
		{
			name: "create_contact_if_needed",
			type: "tool_call",
			description: "Create contact in CRM if not exists",
			requiredData: ["firstName", "lastName", "phone"],
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
			description: "Send appointment confirmation message",
			requiredData: ["contactId", "appointmentId"],
			nextStep: "end",
			toolName: "send_message",
			toolArgs: (state: WorkflowState) => ({
				contactId: state.data.contactId as string,
				message: `Your appointment has been confirmed for ${state.data.appointmentSlot}. We look forward to seeing you!`,
			}),
		},
		{
			name: "end",
			type: "end",
			description: "Workflow completed",
			requiredData: [],
		},
	],
};

/**
 * Get appointment workflow definition
 */
export function getAppointmentWorkflow(): WorkflowDefinition {
	return appointmentWorkflow;
}
