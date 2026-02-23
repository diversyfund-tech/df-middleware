/**
 * Enhanced Workflow Canvas Component
 * 
 * React Flow canvas with drag-drop, node deletion, and connection handling.
 * Replaces WorkflowVisualization with enhanced editing capabilities.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	useNodesState,
	useEdgesState,
	useReactFlow,
	addEdge,
	ReactFlowProvider,
	type Connection,
	type Edge,
	type Node,
	Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowDefinition } from "@/lib/workflows/types";
import { workflowToFlowElements } from "@/lib/workflows/visualization";
import CollectInfoNode from "../nodes/CollectInfoNode";
import ToolCallNode from "../nodes/ToolCallNode";
import DecisionNode from "../nodes/DecisionNode";
import CompleteNode from "../nodes/CompleteNode";
import WorkflowNode from "../WorkflowNode";

const nodeTypes = {
	collectInfoNode: CollectInfoNode,
	toolCallNode: ToolCallNode,
	decisionNode: DecisionNode,
	completeNode: CompleteNode,
	defaultNode: WorkflowNode,
};

interface WorkflowCanvasProps {
	workflow: WorkflowDefinition | null;
	selectedStep?: string;
	onStepSelect?: (stepName: string) => void;
	onWorkflowChange?: (workflow: WorkflowDefinition) => void;
	onNodeAdd?: (nodeType: string, toolName?: string) => void;
	className?: string;
}

function WorkflowCanvasInner({
	workflow,
	selectedStep,
	onStepSelect,
	onWorkflowChange,
	onNodeAdd,
	className,
}: WorkflowCanvasProps) {
	const [nodes, setNodes, onNodesChange] = useNodesState([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);
	const reactFlowInstance = useReactFlow();
	const reactFlowWrapper = useRef<HTMLDivElement>(null);

	// Update nodes/edges when workflow changes
	useEffect(() => {
		if (workflow) {
			const { nodes: newNodes, edges: newEdges } = workflowToFlowElements(workflow);
			setNodes(newNodes);
			setEdges(newEdges);
		} else {
			setNodes([]);
			setEdges([]);
		}
	}, [workflow, setNodes, setEdges]);

	// Highlight selected step
	useEffect(() => {
		if (selectedStep && workflow) {
			setNodes((nds) =>
				nds.map((node) => ({
					...node,
					selected: node.id === selectedStep,
				}))
			);
		} else if (!selectedStep && workflow) {
			setNodes((nds) =>
				nds.map((node) => ({
					...node,
					selected: false,
				}))
			);
		}
	}, [selectedStep, workflow, setNodes]);

	const onConnect = useCallback(
		(params: Connection | Edge) => {
			const newEdge = addEdge(params, edges);
			setEdges(newEdge);

			// Update workflow definition with new connection
			if (workflow && onWorkflowChange) {
				const sourceStep = workflow.steps.find((s) => s.name === params.source);
				if (sourceStep) {
					const updatedSteps = workflow.steps.map((s) =>
						s.name === sourceStep.name
							? { ...s, nextStep: params.target || undefined }
							: s
					);
					onWorkflowChange({
						...workflow,
						steps: updatedSteps,
					});
				}
			}
		},
		[edges, workflow, onWorkflowChange, setEdges]
	);

	const onNodeClick = useCallback(
		(_event: React.MouseEvent, node: Node) => {
			onStepSelect?.(node.id);
		},
		[onStepSelect]
	);

	const onNodesDelete = useCallback(
		(deleted: Node[]) => {
			if (!workflow || !onWorkflowChange) return;

			const deletedStepNames = deleted.map((n) => n.id);
			const updatedSteps = workflow.steps.filter(
				(s) => !deletedStepNames.includes(s.name)
			);

			// Remove references to deleted steps
			updatedSteps.forEach((s) => {
				if (s.nextStep && deletedStepNames.includes(s.nextStep as string)) {
					s.nextStep = null;
				}
			});

			// Update initialStep if it was deleted
			const newInitialStep =
				deletedStepNames.includes(workflow.initialStep) && updatedSteps.length > 0
					? updatedSteps[0].name
					: workflow.initialStep;

			onWorkflowChange({
				...workflow,
				steps: updatedSteps,
				initialStep: newInitialStep,
			});
		},
		[workflow, onWorkflowChange]
	);

	// Handle drag from palette
	const onDragOver = useCallback((event: React.DragEvent) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
	}, []);

	const onDrop = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault();

			if (!reactFlowInstance || !onWorkflowChange) return;

			const data = event.dataTransfer.getData("application/reactflow");
			if (!data) return;

			try {
				const { nodeType, toolName } = JSON.parse(data);
				const position = reactFlowInstance.screenToFlowPosition({
					x: event.clientX,
					y: event.clientY,
				});

				// Generate unique step name
				const stepName = `step_${Date.now()}`;
				const stepDescription =
					nodeType === "tool_call" && toolName
						? `Execute ${toolName}`
						: nodeType === "collect_info"
							? "Collect information"
							: nodeType === "decision"
								? "Make decision"
								: "Complete workflow";

				// Create new step
				const newStep = {
					name: stepName,
					type: nodeType,
					description: stepDescription,
					...(nodeType === "tool_call" && toolName ? { toolName } : {}),
					nextStep: null,
				};

				// Add to workflow or create new workflow
				let updatedWorkflow: WorkflowDefinition;
				if (workflow) {
					const updatedSteps = [...workflow.steps, newStep];
					const newInitialStep = workflow.steps.length === 0 ? stepName : workflow.initialStep;
					updatedWorkflow = {
						...workflow,
						steps: updatedSteps,
						initialStep: newInitialStep,
					};
				} else {
					// Create new workflow
					updatedWorkflow = {
						type: "custom",
						name: "New Workflow",
						description: "Workflow created in visual builder",
						steps: [newStep],
						initialStep: stepName,
					};
				}

				onWorkflowChange(updatedWorkflow);
				onNodeAdd?.(nodeType, toolName);
			} catch (error) {
				console.error("[WorkflowCanvas] Failed to parse drag data:", error);
			}
		},
		[reactFlowInstance, workflow, onWorkflowChange, onNodeAdd]
	);

	// Show empty state only if no workflow and no nodes
	if (!workflow && nodes.length === 0) {
		return (
			<div className={className} style={{ width: "100%", height: "100%" }}>
				<div className="h-full flex items-center justify-center text-muted-foreground">
					<div className="text-center">
						<div className="text-4xl mb-4">🎨</div>
						<p className="text-lg font-medium">No workflow loaded</p>
						<p className="text-sm mt-2">Drag nodes from the palette to get started</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={className} style={{ width: "100%", height: "100%" }} ref={reactFlowWrapper}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onNodeClick={onNodeClick}
				onNodesDelete={onNodesDelete}
				onDragOver={onDragOver}
				onDrop={onDrop}
				nodeTypes={nodeTypes}
				fitView
				attributionPosition="bottom-left"
				className="bg-zinc-50 dark:bg-zinc-950"
				deleteKeyCode={["Backspace", "Delete"]}
			>
				<Background color="#3b82f6" gap={16} />
				<Controls />
				<MiniMap
					nodeColor={(node) => {
						const stepType = (node.data as { stepType?: string })?.stepType || "";
						switch (stepType) {
							case "collect_info":
								return "#3b82f6";
							case "tool_call":
								return "#22c55e";
							case "decision":
								return "#eab308";
							case "complete":
								return "#ef4444";
							default:
								return "#6b7280";
						}
					}}
					maskColor="rgba(0, 0, 0, 0.3)"
				/>
				<Panel position="top-left" className="bg-background/80 backdrop-blur-sm p-2 rounded-lg border border-white/10 text-xs text-muted-foreground">
					Drag nodes from palette • Click to select • Connect with handles • Delete with Backspace
				</Panel>
			</ReactFlow>
		</div>
	);
}

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
	return (
		<ReactFlowProvider>
			<WorkflowCanvasInner {...props} />
		</ReactFlowProvider>
	);
}
