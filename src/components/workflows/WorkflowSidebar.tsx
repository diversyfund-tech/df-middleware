/**
 * Workflow Sidebar Component
 * 
 * Right panel showing workflow visualization and step details.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import GlassPanel from "@/components/ui/GlassPanel";
import WorkflowVisualization from "./WorkflowVisualization";
import WorkflowStepEditor from "./WorkflowStepEditor";
import type { WorkflowDefinition, WorkflowStepDefinition } from "@/lib/workflows/types";
import { getNodeIcon, getNodeColor } from "@/lib/workflows/visualization";
import { Button } from "@/components/ui/Button";
import { Save, Download, X, Plus } from "lucide-react";

interface WorkflowSidebarProps {
	workflow: WorkflowDefinition | null;
	selectedStep?: string;
	onStepSelect?: (stepName: string) => void;
	onSave?: () => void;
	onExport?: () => void;
	className?: string;
}

export default function WorkflowSidebar({
	workflow,
	selectedStep,
	onStepSelect,
	onWorkflowUpdate,
	onSave,
	onExport,
	className,
}: WorkflowSidebarProps) {
	const [showDetails, setShowDetails] = useState(true);
	const [editingStep, setEditingStep] = useState<string | null>(null);

	const selectedStepData = workflow?.steps.find((s) => s.name === selectedStep);
	const editingStepData = workflow?.steps.find((s) => s.name === editingStep);

	const handleStepUpdate = (updatedStep: WorkflowStepDefinition) => {
		if (!workflow || !onWorkflowUpdate) return;

		const updatedSteps = workflow.steps.map((s) =>
			s.name === updatedStep.name ? updatedStep : s
		);

		// Update nextStep references if step name changed
		if (updatedStep.name !== editingStep) {
			const oldName = editingStep!;
			const newName = updatedStep.name;
			updatedSteps.forEach((s) => {
				if (s.nextStep === oldName) {
					s.nextStep = newName;
				}
			});
			// Update initialStep if it was the renamed step
			const newInitialStep =
				workflow.initialStep === oldName ? newName : workflow.initialStep;
			onWorkflowUpdate({
				...workflow,
				steps: updatedSteps,
				initialStep: newInitialStep,
			});
		} else {
			onWorkflowUpdate({
				...workflow,
				steps: updatedSteps,
			});
		}

		setEditingStep(null);
	};

	const handleStepDelete = () => {
		if (!workflow || !onWorkflowUpdate || !editingStep) return;

		if (
			!confirm(
				`Are you sure you want to delete step "${editingStep}"? This cannot be undone.`
			)
		) {
			return;
		}

		const updatedSteps = workflow.steps.filter((s) => s.name !== editingStep);

		// Remove references to deleted step
		updatedSteps.forEach((s) => {
			if (s.nextStep === editingStep) {
				s.nextStep = null;
			}
		});

		// Update initialStep if it was the deleted step
		const newInitialStep =
			workflow.initialStep === editingStep && updatedSteps.length > 0
				? updatedSteps[0].name
				: workflow.initialStep;

		onWorkflowUpdate({
			...workflow,
			steps: updatedSteps,
			initialStep: newInitialStep,
		});

		setEditingStep(null);
		setShowDetails(false);
	};

	const handleAddStep = () => {
		if (!workflow || !onWorkflowUpdate) return;

		const newStepName = `step_${workflow.steps.length + 1}`;
		const newStep: WorkflowStepDefinition = {
			name: newStepName,
			type: "collect_info",
			description: "New step",
			nextStep: null,
		};

		// If there are existing steps, link the last one to the new step
		const updatedSteps = [...workflow.steps];
		if (updatedSteps.length > 0) {
			const lastStep = updatedSteps[updatedSteps.length - 1];
			lastStep.nextStep = newStepName;
		}
		updatedSteps.push(newStep);

		onWorkflowUpdate({
			...workflow,
			steps: updatedSteps,
		});

		setEditingStep(newStepName);
		setShowDetails(true);
	};

	return (
		<div className={cn("h-full flex flex-col", className)}>
			{/* Header */}
			<div className="p-4 border-b border-white/10 flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold">Workflow Visualization</h3>
					{workflow && (
						<p className="text-sm text-muted-foreground">
							{workflow.name} • {workflow.steps.length} steps
						</p>
					)}
				</div>
					<div className="flex gap-2">
						{workflow && (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={onSave}
									className="border-green-500/30 hover:bg-green-500/10 text-green-400"
								>
									<Save className="h-4 w-4 mr-2" />
									Submit & Save
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={onExport}
									className="border-cyan-500/30 hover:bg-cyan-500/10"
								>
									<Download className="h-4 w-4 mr-2" />
									Export
								</Button>
							</>
						)}
					{selectedStepData && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowDetails(!showDetails)}
						>
							{showDetails ? (
								<X className="h-4 w-4" />
							) : (
								<span className="text-xs">Details</span>
							)}
						</Button>
					)}
				</div>
			</div>

			{/* Visualization Canvas */}
			<div className="flex-1 relative min-h-0">
				<WorkflowVisualization
					workflow={workflow}
					selectedStep={selectedStep}
					onStepSelect={onStepSelect}
					className="absolute inset-0"
				/>
			</div>

			{/* Step Editor or Details Panel */}
			{showDetails && editingStepData && (
				<div className="m-4">
					<WorkflowStepEditor
						step={editingStepData}
						stepIndex={workflow.steps.findIndex((s) => s.name === editingStep)}
						onSave={handleStepUpdate}
						onCancel={() => setEditingStep(null)}
						onDelete={handleStepDelete}
						allSteps={workflow.steps}
					/>
				</div>
			)}

			{showDetails && selectedStepData && !editingStepData && (
				<GlassPanel
					variant="default"
					className="m-4 p-4 border-cyan-500/30 shadow-[0_0_15px_rgba(0,150,255,0.2)] cursor-pointer hover:border-cyan-500/50 transition-colors"
					onClick={() => setEditingStep(selectedStep)}
				>
					<div className="space-y-3">
						<div className="flex items-start gap-3">
							<span className="text-2xl">
								{getNodeIcon(selectedStepData.type)}
							</span>
							<div className="flex-1">
								<div className="flex items-center justify-between mb-1">
									<h4 className="font-semibold text-sm">
										{selectedStepData.name.replace(/_/g, " ")}
									</h4>
									<Button
										variant="ghost"
										size="sm"
										onClick={(e) => {
											e.stopPropagation();
											setEditingStep(selectedStep);
										}}
										className="h-6 px-2 text-xs"
									>
										Edit
									</Button>
								</div>
								<p className="text-xs text-muted-foreground">
									{selectedStepData.description}
								</p>
							</div>
						</div>

						<div className="pt-2 border-t border-white/10 space-y-2">
							<div>
								<span className="text-xs font-medium text-muted-foreground">
									Type:
								</span>
								<span
									className={cn(
										"ml-2 px-2 py-1 rounded text-xs",
										getNodeColor(selectedStepData.type),
										"text-white"
									)}
								>
									{selectedStepData.type.replace(/_/g, " ")}
								</span>
							</div>

							{selectedStepData.toolName && (
								<div>
									<span className="text-xs font-medium text-muted-foreground">
										Tool:
									</span>
									<code className="ml-2 px-2 py-1 rounded text-xs bg-zinc-800 text-cyan-400">
										{selectedStepData.toolName}
									</code>
								</div>
							)}

							{selectedStepData.requiredData &&
								selectedStepData.requiredData.length > 0 && (
									<div>
										<span className="text-xs font-medium text-muted-foreground">
											Required Data:
										</span>
										<div className="mt-1 flex flex-wrap gap-1">
											{selectedStepData.requiredData.map((field, idx) => (
												<span
													key={idx}
													className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-300"
												>
													{field}
												</span>
											))}
										</div>
									</div>
								)}

							{selectedStepData.nextStep && (
								<div>
									<span className="text-xs font-medium text-muted-foreground">
										Next Step:
									</span>
									<span className="ml-2 text-xs text-cyan-400">
										{typeof selectedStepData.nextStep === "string"
											? selectedStepData.nextStep.replace(/_/g, " ")
											: "Conditional"}
									</span>
								</div>
							)}
						</div>

						<div className="pt-2 border-t border-white/10">
							<p className="text-xs text-muted-foreground italic">
								Click anywhere to edit this step
							</p>
						</div>
					</div>
				</GlassPanel>
			)}

			{/* Add Step Button */}
			{workflow && !editingStepData && (
				<div className="px-4 pb-4">
					<Button
						variant="outline"
						size="sm"
						onClick={handleAddStep}
						className="w-full border-cyan-500/30 hover:bg-cyan-500/10"
					>
						<Plus className="h-4 w-4 mr-2" />
						Add Step
					</Button>
				</div>
			)}

			{/* Empty State */}
			{!workflow && (
				<div className="flex-1 flex items-center justify-center p-8 text-center bg-gradient-to-br from-zinc-900/50 to-zinc-800/50">
					<div className="space-y-4 max-w-md">
						<div className="text-6xl mb-4">🎨</div>
						<p className="text-xl font-medium text-zinc-200">Workflow Visualization</p>
						<p className="text-sm text-zinc-400 leading-relaxed">
							As you chat with the AI, your workflow will appear here in real-time. 
							The AI will generate a visual flow diagram showing all steps, connections, 
							and decision points.
						</p>
						<div className="mt-6 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
							<p className="text-xs text-zinc-400 mb-2">💡 Tip:</p>
							<p className="text-xs text-zinc-300">
								Ask the AI to "create a sales workflow" or describe what you want, 
								and it will generate a complete workflow definition that appears here automatically.
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
