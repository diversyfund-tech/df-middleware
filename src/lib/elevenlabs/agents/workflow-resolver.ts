/**
 * Agent Workflow Resolver
 * 
 * Resolves workflow type from agent config and maps to workflow implementation.
 */

import { getWorkflowTypeForAgent } from "@/lib/workflows/workflow-resolver";
import { getSalesWorkflow } from "@/lib/workflows/sales-workflow";
import { getSupportWorkflow } from "@/lib/workflows/support-workflow";
import { getAppointmentWorkflow } from "@/lib/workflows/appointment-workflow";
import type { WorkflowDefinition, WorkflowType } from "@/lib/workflows/types";

/**
 * Get workflow definition for an agent
 */
export async function getWorkflowForAgent(agentId: string): Promise<WorkflowDefinition | null> {
	const workflowType = await getWorkflowTypeForAgent(agentId);
	if (!workflowType) {
		return null;
	}

	return getWorkflowDefinition(workflowType);
}

/**
 * Get workflow definition by type
 */
export function getWorkflowDefinition(workflowType: WorkflowType): WorkflowDefinition | null {
	switch (workflowType) {
		case "sales":
			return getSalesWorkflow();
		case "support":
			return getSupportWorkflow();
		case "appointment":
			return getAppointmentWorkflow();
		case "custom":
			// TODO: Implement custom workflow loading from database or config
			console.warn("[workflow-resolver] Custom workflow loading not yet implemented");
			return null;
		default:
			return null;
	}
}
