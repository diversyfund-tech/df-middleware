/**
 * Flowise Execute API Endpoint
 * 
 * Executes a Flowise node as part of a workflow.
 */

import { NextRequest, NextResponse } from "next/server";
import { executeFlowiseNode } from "@/lib/flowise/integration";
import { getFlowiseNodeByName } from "@/lib/flowise/nodes";
import { getWorkflowExecution } from "@/lib/workflows/workflow-engine";
import { getSyncWorkflow } from "@/lib/workflows/sync-workflows";
import { salesWorkflow } from "@/lib/workflows/sales-workflow";
import { supportWorkflow } from "@/lib/workflows/support-workflow";
import { appointmentWorkflow } from "@/lib/workflows/appointment-workflow";

/**
 * POST /api/flowise/execute
 * 
 * Execute a Flowise node.
 * Body:
 * {
 *   nodeName: string;
 *   nodeData: Record<string, unknown>;
 *   workflowExecutionId: string;
 *   stepName: string;
 * }
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { nodeName, nodeData, workflowExecutionId, stepName } = body;

		if (!nodeName || !workflowExecutionId || !stepName) {
			return NextResponse.json(
				{ error: "Missing required fields: nodeName, workflowExecutionId, stepName" },
				{ status: 400 }
			);
		}

		// Get node definition
		const node = getFlowiseNodeByName(nodeName);
		if (!node) {
			return NextResponse.json(
				{ error: `Node ${nodeName} not found` },
				{ status: 404 }
			);
		}

		// Get workflow execution
		const execution = await getWorkflowExecution(workflowExecutionId);
		if (!execution) {
			return NextResponse.json(
				{ error: `Workflow execution ${workflowExecutionId} not found` },
				{ status: 404 }
			);
		}

		// Get workflow definition based on type
		let workflowDef;
		switch (execution.workflowType) {
			case "sync":
				// For sync workflows, we need to determine the specific type
				// This is a simplified version - in production, you'd store the full workflow definition
				workflowDef = getSyncWorkflow("contact", "aloware_to_ghl");
				break;
			case "sales":
				workflowDef = salesWorkflow;
				break;
			case "support":
				workflowDef = supportWorkflow;
				break;
			case "appointment":
				workflowDef = appointmentWorkflow;
				break;
			default:
				return NextResponse.json(
					{ error: `Unknown workflow type: ${execution.workflowType}` },
					{ status: 400 }
				);
		}

		// Execute node
		const result = await executeFlowiseNode(
			node,
			nodeData || {},
			workflowExecutionId,
			workflowDef,
			stepName
		);

		return NextResponse.json(result);
	} catch (error: any) {
		console.error("[flowise-execute] Error:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
