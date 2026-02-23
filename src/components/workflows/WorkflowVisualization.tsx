/**
 * Workflow Visualization Component
 * 
 * Renders workflow as an interactive flow diagram using react-flow
 */

"use client";

import { useCallback, useEffect } from "react";
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	useNodesState,
	useEdgesState,
	addEdge,
	type Connection,
	type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowDefinition } from "@/lib/workflows/types";
import { workflowToFlowElements } from "@/lib/workflows/visualization";
import WorkflowNode from "./WorkflowNode";

const nodeTypes = {
	collectInfoNode: WorkflowNode,
	toolCallNode: WorkflowNode,
	decisionNode: WorkflowNode,
	completeNode: WorkflowNode,
	defaultNode: WorkflowNode,
};

interface WorkflowVisualizationProps {
	workflow: WorkflowDefinition | null;
	selectedStep?: string;
	onStepSelect?: (stepName: string) => void;
	className?: string;
}

export default function WorkflowVisualization({
	workflow,
	selectedStep,
	onStepSelect,
	className,
}: WorkflowVisualizationProps) {
	const [nodes, setNodes, onNodesChange] = useNodesState([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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
		(params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
		[setEdges]
	);

	const onNodeClick = useCallback(
		(event: React.MouseEvent, node: { id: string }) => {
			onStepSelect?.(node.id);
		},
		[onStepSelect]
	);

	const onNodeDoubleClick = useCallback(
		(_event: React.MouseEvent, node: { id: string }) => {
			// Double-click could trigger edit mode in the future
			onStepSelect?.(node.id);
		},
		[onStepSelect]
	);

	if (!workflow) {
		return null; // Let parent handle empty state
	}

	return (
		<div className={className} style={{ width: "100%", height: "100%" }}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onNodeClick={onNodeClick}
				onNodeDoubleClick={onNodeDoubleClick}
				nodeTypes={nodeTypes}
				fitView
				attributionPosition="bottom-left"
				className="bg-zinc-50 dark:bg-zinc-950"
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
			</ReactFlow>
		</div>
	);
}
