/**
 * Workflow Visualization Utilities
 * 
 * Converts WorkflowDefinition to react-flow nodes and edges
 * for visual workflow diagram rendering.
 */

import type { Node, Edge } from "@xyflow/react";
import type { WorkflowDefinition, WorkflowStepDefinition } from "./types";

export interface WorkflowNodeData {
	stepName: string;
	stepType: string;
	description: string;
	toolName?: string;
	requiredData?: string[];
}

/**
 * Convert workflow definition to react-flow nodes and edges
 */
export function workflowToFlowElements(
	workflow: WorkflowDefinition
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
	const nodes: Node<WorkflowNodeData>[] = [];
	const edges: Edge[] = [];
	const stepPositions = new Map<string, { x: number; y: number }>();

	// Calculate positions using a simple layout algorithm
	const nodeWidth = 200;
	const nodeHeight = 100;
	const horizontalSpacing = 250;
	const verticalSpacing = 150;

	// Group steps by depth (distance from initial step)
	const stepDepths = calculateStepDepths(workflow);
	const maxDepth = Math.max(...Array.from(stepDepths.values()));

	// Group steps by depth
	const stepsByDepth: WorkflowStepDefinition[][] = [];
	for (let depth = 0; depth <= maxDepth; depth++) {
		stepsByDepth[depth] = [];
	}

	for (const step of workflow.steps) {
		const depth = stepDepths.get(step.name) || 0;
		stepsByDepth[depth].push(step);
	}

	// Position nodes
	let nodeIdCounter = 0;
	for (let depth = 0; depth <= maxDepth; depth++) {
		const stepsAtDepth = stepsByDepth[depth];
		const y = depth * verticalSpacing + 100;
		const totalWidth = stepsAtDepth.length * horizontalSpacing;
		const startX = 400 - totalWidth / 2 + horizontalSpacing / 2;

		stepsAtDepth.forEach((step, index) => {
			const x = startX + index * horizontalSpacing;
			stepPositions.set(step.name, { x, y });

			const node: Node<WorkflowNodeData> = {
				id: step.name,
				type: getNodeType(step.type),
				position: { x, y },
				data: {
					stepName: step.name,
					stepType: step.type,
					description: step.description,
					toolName: step.toolName,
					requiredData: step.requiredData,
				},
			};

			nodes.push(node);
		});
	}

	// Create edges based on nextStep relationships
	for (const step of workflow.steps) {
		if (!step.nextStep) continue;

		if (typeof step.nextStep === "string") {
			// Simple string reference
			const sourcePos = stepPositions.get(step.name);
			const targetPos = stepPositions.get(step.nextStep);
			if (sourcePos && targetPos) {
				edges.push({
					id: `${step.name}-${step.nextStep}`,
					source: step.name,
					target: step.nextStep,
					type: "smoothstep",
					animated: false,
				});
			}
		} else {
			// Function - create edges for both possible paths
			// This is a simplified approach - in reality we'd need to analyze the function
			// For now, we'll create edges based on common patterns
			// TODO: Parse function to determine branches
		}
	}

	return { nodes, edges };
}

/**
 * Calculate depth of each step from initial step
 */
function calculateStepDepths(
	workflow: WorkflowDefinition
): Map<string, number> {
	const depths = new Map<string, number>();
	const visited = new Set<string>();

	function traverse(stepName: string, depth: number) {
		if (visited.has(stepName)) return;
		visited.add(stepName);

		const currentDepth = depths.get(stepName);
		if (currentDepth === undefined || depth < currentDepth) {
			depths.set(stepName, depth);
		}

		const step = workflow.steps.find((s) => s.name === stepName);
		if (!step || !step.nextStep) return;

		if (typeof step.nextStep === "string") {
			traverse(step.nextStep, depth + 1);
		}
	}

	traverse(workflow.initialStep, 0);
	return depths;
}

/**
 * Get react-flow node type based on step type
 */
function getNodeType(stepType: string): string {
	switch (stepType) {
		case "collect_info":
			return "collectInfoNode";
		case "tool_call":
			return "toolCallNode";
		case "decision":
			return "decisionNode";
		case "complete":
			return "completeNode";
		default:
			return "defaultNode";
	}
}

/**
 * Get node color based on step type
 */
export function getNodeColor(stepType: string): string {
	switch (stepType) {
		case "collect_info":
			return "bg-blue-500";
		case "tool_call":
			return "bg-green-500";
		case "decision":
			return "bg-yellow-500";
		case "complete":
			return "bg-red-500";
		default:
			return "bg-gray-500";
	}
}

/**
 * Get node icon based on step type
 */
export function getNodeIcon(stepType: string): string {
	switch (stepType) {
		case "collect_info":
			return "📝";
		case "tool_call":
			return "🔧";
		case "decision":
			return "❓";
		case "complete":
			return "✅";
		default:
			return "⚙️";
	}
}

/**
 * Convert React Flow nodes and edges back to WorkflowDefinition
 * This enables bidirectional sync between canvas and workflow definition
 */
export function flowElementsToWorkflow(
	nodes: Node<WorkflowNodeData>[],
	edges: Edge[],
	baseWorkflow: WorkflowDefinition
): WorkflowDefinition {
	// Create a map of node IDs to their next steps based on edges
	const nextStepMap = new Map<string, string | null>();
	
	// Initialize all nodes with null nextStep
	nodes.forEach((node) => {
		nextStepMap.set(node.id, null);
	});

	// Update nextStep based on edges
	edges.forEach((edge) => {
		const sourceId = edge.source;
		const currentNext = nextStepMap.get(sourceId);
		// For now, only support single nextStep (not conditional branches)
		// TODO: Handle multiple edges from decision nodes
		if (currentNext === null) {
			nextStepMap.set(sourceId, edge.target);
		}
	});

	// Rebuild steps array from nodes
	const steps = nodes.map((node) => {
		const existingStep = baseWorkflow.steps.find((s) => s.name === node.id);
		const nextStep = nextStepMap.get(node.id) || undefined;

		return {
			name: node.id,
			type: node.data.stepType as WorkflowStepDefinition["type"],
			description: node.data.description,
			requiredData: node.data.requiredData,
			toolName: node.data.toolName,
			nextStep: nextStep || null,
			// Preserve existing callbacks if step exists
			onSuccess: existingStep?.onSuccess,
			onFailure: existingStep?.onFailure,
		};
	});

	// Determine initial step (first node or existing initialStep if it exists)
	const initialStep =
		baseWorkflow.steps.find((s) => s.name === baseWorkflow.initialStep) &&
		nodes.some((n) => n.id === baseWorkflow.initialStep)
			? baseWorkflow.initialStep
			: nodes.length > 0
				? nodes[0].id
				: baseWorkflow.initialStep;

	return {
		...baseWorkflow,
		steps,
		initialStep,
	};
}

/**
 * Create a new node from node type and optional tool name
 */
export function createNodeFromType(
	nodeType: string,
	toolName?: string,
	position?: { x: number; y: number }
): Node<WorkflowNodeData> {
	const stepName = `step_${Date.now()}`;
	const description =
		nodeType === "tool_call" && toolName
			? `Execute ${toolName}`
			: nodeType === "collect_info"
				? "Collect information"
				: nodeType === "decision"
					? "Make decision"
					: "Complete workflow";

	return {
		id: stepName,
		type: getNodeType(nodeType),
		position: position || { x: 250, y: 100 },
		data: {
			stepName,
			stepType: nodeType,
			description,
			toolName,
			requiredData: [],
		},
	};
}
