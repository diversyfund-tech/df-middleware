/**
 * Workflow Execution API
 * 
 * POST /api/workflows/execute
 * Executes a workflow step from ElevenLabs webhook or direct API call.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWorkflowForAgent } from "@/lib/elevenlabs/agents/workflow-resolver";
import { executeWorkflowStep } from "@/lib/workflows/workflow-engine";
import { executeWithCircuitBreaker } from "@/lib/workflows/error-handler";

export interface WorkflowExecuteRequest {
	executionId: string;
	stepName: string;
	toolArgs?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
	try {
		const body: WorkflowExecuteRequest = await req.json();
		const { executionId, stepName, toolArgs } = body;

		if (!executionId) {
			return NextResponse.json({ error: "executionId is required" }, { status: 400 });
		}

		if (!stepName) {
			return NextResponse.json({ error: "stepName is required" }, { status: 400 });
		}

		// Get execution to find agent ID and workflow type
		const { getWorkflowExecution } = await import("@/lib/workflows/workflow-engine");
		const execution = await getWorkflowExecution(executionId);
		
		if (!execution) {
			return NextResponse.json({ error: "Workflow execution not found" }, { status: 404 });
		}

		// Get workflow definition
		const workflowDef = await getWorkflowForAgent(execution.agentId);
		if (!workflowDef) {
			return NextResponse.json(
				{ error: `No workflow found for agent ${execution.agentId}` },
				{ status: 404 }
			);
		}

		// Execute workflow step
		const result = await executeWithCircuitBreaker(
			"workflow-execution",
			() => executeWorkflowStep(executionId, workflowDef, stepName, toolArgs)
		);

		return NextResponse.json({
			success: result.status === "completed",
			stepName: result.stepName,
			status: result.status,
			toolResult: result.toolResult,
			collectedData: result.collectedData,
			error: result.error,
			nextStep: result.nextStep,
		});
	} catch (error: any) {
		console.error("[workflows.execute] Error:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
