/**
 * Flowise Integration Layer
 * 
 * Provides integration between Flowise visual workflow builder
 * and the DF-Middleware workflow engine.
 */

import { executeWorkflowStep, createWorkflowExecution, getWorkflowExecution } from "@/lib/workflows/workflow-engine";
import type { WorkflowDefinition, WorkflowState } from "@/lib/workflows/types";
import type { FlowiseNodeDefinition } from "./nodes";
import { logger } from "@/lib/logger";

/**
 * Execute a Flowise node as a workflow step
 */
export async function executeFlowiseNode(
	node: FlowiseNodeDefinition,
	nodeData: Record<string, unknown>,
	workflowExecutionId: string,
	workflowDef: WorkflowDefinition,
	stepName: string
): Promise<{ success: boolean; output?: unknown; error?: string }> {
	try {
		// Map Flowise node to workflow step
		const stepDef = workflowDef.steps.find(s => s.name === stepName);
		if (!stepDef) {
			throw new Error(`Step ${stepName} not found in workflow definition`);
		}

		// Prepare tool arguments from node inputs
		const toolArgs: Record<string, unknown> = {};
		for (const input of node.inputs) {
			if (input.name in nodeData) {
				toolArgs[input.name] = nodeData[input.name];
			} else if (input.default !== undefined) {
				toolArgs[input.name] = input.default;
			}
		}

		// Execute workflow step
		const result = await executeWorkflowStep(
			workflowExecutionId,
			workflowDef,
			stepName,
			toolArgs
		);

		if (result.status === "completed") {
			// Map workflow result to Flowise node output
			const output: Record<string, unknown> = {};
			for (const outputDef of node.outputs) {
				if (outputDef.name === "status") {
					output.status = "success";
				} else if (result.toolResult?.data) {
					const toolData = result.toolResult.data as Record<string, unknown>;
					if (outputDef.name in toolData) {
						output[outputDef.name] = toolData[outputDef.name];
					}
				}
			}

			return {
				success: true,
				output,
			};
		} else {
			return {
				success: false,
				error: result.error || "Step execution failed",
			};
		}
	} catch (error: any) {
		logger.error({ node: node.name, error }, "Flowise node execution failed");
		return {
			success: false,
			error: error.message || String(error),
		};
	}
}

/**
 * Convert Flowise workflow to WorkflowDefinition
 */
export function flowiseToWorkflowDefinition(
	flowiseWorkflow: {
		nodes: Array<{ id: string; data: FlowiseNodeDefinition & { nodeData: Record<string, unknown> } }>;
		edges: Array<{ source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
	},
	workflowType: string,
	name: string,
	description: string
): WorkflowDefinition {
	const steps: Array<{
		name: string;
		type: string;
		description: string;
		requiredData?: string[];
		toolName?: string;
		syncConfig?: unknown;
		nextStep?: string;
	}> = [];

	// Find initial node (node with no incoming edges)
	const nodeIds = new Set(flowiseWorkflow.nodes.map(n => n.id));
	const targetNodes = new Set(flowiseWorkflow.edges.map(e => e.target));
	const initialNodeId = flowiseWorkflow.nodes.find(n => !targetNodes.has(n.id))?.id;

	if (!initialNodeId) {
		throw new Error("No initial node found in Flowise workflow");
	}

	// Build step map
	const stepMap = new Map<string, string>(); // nodeId -> stepName
	let stepCounter = 0;

	for (const node of flowiseWorkflow.nodes) {
		const stepName = `step_${stepCounter++}`;
		stepMap.set(node.id, stepName);

		const nodeDef = node.data;
		const step: any = {
			name: stepName,
			type: nodeDef.workflowStepType || "tool_call",
			description: nodeDef.description,
		};

		// Map inputs to requiredData
		const requiredData = nodeDef.inputs
			.filter(input => input.required)
			.map(input => input.name);
		if (requiredData.length > 0) {
			step.requiredData = requiredData;
		}

		// Set toolName if it's a tool call node
		if (nodeDef.workflowStepType === "tool_call" && nodeDef.name === "ToolCall") {
			step.toolName = (node.data.nodeData as Record<string, unknown>).toolName as string;
		}

		// Set syncConfig if it's a sync node
		if (nodeDef.workflowStepType?.startsWith("sync_")) {
			step.syncConfig = {
				source: (node.data.nodeData as Record<string, unknown>).source,
				target: (node.data.nodeData as Record<string, unknown>).target,
				direction: (node.data.nodeData as Record<string, unknown>).direction,
			};
		}

		steps.push(step);
	}

	// Set nextStep based on edges
	for (let i = 0; i < steps.length; i++) {
		const nodeId = Array.from(stepMap.entries()).find(([_, stepName]) => stepName === steps[i].name)?.[0];
		if (nodeId) {
			const outgoingEdges = flowiseWorkflow.edges.filter(e => e.source === nodeId);
			if (outgoingEdges.length > 0) {
				const targetNodeId = outgoingEdges[0].target;
				const targetStepName = stepMap.get(targetNodeId);
				if (targetStepName) {
					steps[i].nextStep = targetStepName;
				}
			}
		}
	}

	const initialStep = stepMap.get(initialNodeId);
	if (!initialStep) {
		throw new Error("Initial step not found");
	}

	return {
		type: workflowType as any,
		name,
		description,
		steps: steps as any,
		initialStep,
	};
}

/**
 * Validate Flowise workflow structure
 */
export function validateFlowiseWorkflow(
	flowiseWorkflow: {
		nodes: Array<{ id: string; data: FlowiseNodeDefinition & { nodeData: Record<string, unknown> } }>;
		edges: Array<{ source: string; target: string }>;
	}
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check for nodes
	if (!flowiseWorkflow.nodes || flowiseWorkflow.nodes.length === 0) {
		errors.push("Workflow must have at least one node");
	}

	// Check for initial node (node with no incoming edges)
	const nodeIds = new Set(flowiseWorkflow.nodes.map(n => n.id));
	const targetNodes = new Set(flowiseWorkflow.edges.map(e => e.target));
	const initialNodes = flowiseWorkflow.nodes.filter(n => !targetNodes.has(n.id));

	if (initialNodes.length === 0) {
		errors.push("Workflow must have at least one initial node (node with no incoming edges)");
	} else if (initialNodes.length > 1) {
		errors.push("Workflow must have exactly one initial node");
	}

	// Check for complete nodes (nodes with no outgoing edges)
	const sourceNodes = new Set(flowiseWorkflow.edges.map(e => e.source));
	const completeNodes = flowiseWorkflow.nodes.filter(n => !sourceNodes.has(n.id));

	if (completeNodes.length === 0) {
		errors.push("Workflow must have at least one complete node (node with no outgoing edges)");
	}

	// Validate edges reference existing nodes
	for (const edge of flowiseWorkflow.edges) {
		if (!nodeIds.has(edge.source)) {
			errors.push(`Edge references non-existent source node: ${edge.source}`);
		}
		if (!nodeIds.has(edge.target)) {
			errors.push(`Edge references non-existent target node: ${edge.target}`);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
