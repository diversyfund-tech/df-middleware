/**
 * Node Configuration Panel
 * 
 * Rich configuration panel for editing workflow nodes.
 * Inspired by Flowise's node configuration UI.
 */

"use client";

import { useState, useEffect } from "react";
import { Save, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import GlassPanel from "@/components/ui/GlassPanel";
import ToolSelector from "./ToolSelector";
import type { WorkflowStepDefinition, WorkflowDefinition } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

interface NodeConfigPanelProps {
	step: WorkflowStepDefinition | null;
	allSteps: WorkflowStepDefinition[];
	workflow: WorkflowDefinition | null;
	onSave: (step: WorkflowStepDefinition) => void;
	onCancel: () => void;
	onDelete?: () => void;
	className?: string;
}

export default function NodeConfigPanel({
	step,
	allSteps,
	workflow,
	onSave,
	onCancel,
	onDelete,
	className,
}: NodeConfigPanelProps) {
	const [editedStep, setEditedStep] = useState<WorkflowStepDefinition | null>(null);
	const [activeTab, setActiveTab] = useState<"general" | "data" | "connections">("general");

	useEffect(() => {
		if (step) {
			setEditedStep({ ...step });
		}
	}, [step]);

	if (!step || !editedStep) {
		return (
			<GlassPanel variant="default" className={cn("h-full flex items-center justify-center", className)}>
				<div className="text-center text-muted-foreground">
					<div className="text-4xl mb-2">⚙️</div>
					<p className="text-sm">Select a node to configure</p>
				</div>
			</GlassPanel>
		);
	}

	const stepTypes: Array<{ value: WorkflowStepDefinition["type"]; label: string }> = [
		{ value: "collect_info", label: "Collect Info" },
		{ value: "tool_call", label: "Tool Call" },
		{ value: "decision", label: "Decision" },
		{ value: "complete", label: "Complete" },
	];

	const availableNextSteps = allSteps.filter((s) => s.name !== editedStep.name).map((s) => s.name);

	const handleSave = () => {
		if (editedStep) {
			onSave(editedStep);
		}
	};

	const handleRequiredDataChange = (value: string) => {
		const fields = value
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		setEditedStep({ ...editedStep, requiredData: fields });
	};

	return (
		<GlassPanel variant="default" className={cn("h-full flex flex-col overflow-hidden", className)}>
			{/* Header */}
			<div className="p-4 border-b border-white/10 flex items-center justify-between">
				<h3 className="text-lg font-semibold">Configure Node</h3>
				<div className="flex gap-2">
					{onDelete && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onDelete}
							className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
					<Button variant="ghost" size="sm" onClick={onCancel}>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex border-b border-white/10">
				{(["general", "data", "connections"] as const).map((tab) => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab)}
						className={cn(
							"flex-1 px-4 py-2 text-sm font-medium transition-colors",
							activeTab === tab
								? "border-b-2 border-cyan-500 text-cyan-400"
								: "text-muted-foreground hover:text-foreground"
						)}
					>
						{tab.charAt(0).toUpperCase() + tab.slice(1)}
					</button>
				))}
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{/* General Tab */}
				{activeTab === "general" && (
					<>
						{/* Step Name */}
						<div>
							<label className="text-xs font-medium text-muted-foreground mb-1 block">
								Step Name
							</label>
							<input
								type="text"
								value={editedStep.name}
								onChange={(e) => setEditedStep({ ...editedStep, name: e.target.value })}
								className="w-full px-3 py-2 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
								placeholder="step_name"
							/>
						</div>

						{/* Step Type */}
						<div>
							<label className="text-xs font-medium text-muted-foreground mb-1 block">
								Step Type
							</label>
							<select
								value={editedStep.type}
								onChange={(e) =>
									setEditedStep({
										...editedStep,
										type: e.target.value as WorkflowStepDefinition["type"],
										// Clear toolName if switching away from tool_call
										toolName: e.target.value === "tool_call" ? editedStep.toolName : undefined,
									})
								}
								className="w-full px-3 py-2 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
							>
								{stepTypes.map((type) => (
									<option key={type.value} value={type.value}>
										{type.label}
									</option>
								))}
							</select>
						</div>

						{/* Description */}
						<div>
							<label className="text-xs font-medium text-muted-foreground mb-1 block">
								Description
							</label>
							<Textarea
								value={editedStep.description}
								onChange={(e) =>
									setEditedStep({ ...editedStep, description: e.target.value })
								}
								className="w-full min-h-[80px] bg-background/50 backdrop-blur-sm border border-white/20 focus:ring-2 focus:ring-cyan-500/50 text-sm"
								placeholder="What does this step do?"
							/>
						</div>

						{/* Tool Name (for tool_call steps) */}
						{editedStep.type === "tool_call" && (
							<div>
								<label className="text-xs font-medium text-muted-foreground mb-2 block">
									MCP Tool
								</label>
								<ToolSelector
									selectedTool={editedStep.toolName}
									onToolSelect={(toolName) =>
										setEditedStep({ ...editedStep, toolName })
									}
									workflowType={workflow?.type}
								/>
							</div>
						)}
					</>
				)}

				{/* Data Tab */}
				{activeTab === "data" && (
					<div>
						<label className="text-xs font-medium text-muted-foreground mb-1 block">
							Required Data Fields (comma-separated)
						</label>
						<input
							type="text"
							value={editedStep.requiredData?.join(", ") || ""}
							onChange={(e) => handleRequiredDataChange(e.target.value)}
							className="w-full px-3 py-2 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
							placeholder="firstName, lastName, email"
						/>
						<p className="text-xs text-muted-foreground mt-1">
							These fields must be collected before this step can execute
						</p>
						{editedStep.requiredData && editedStep.requiredData.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1">
								{editedStep.requiredData.map((field, idx) => (
									<span
										key={idx}
										className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-300"
									>
										{field}
									</span>
								))}
							</div>
						)}
					</div>
				)}

				{/* Connections Tab */}
				{activeTab === "connections" && (
					<div>
						<label className="text-xs font-medium text-muted-foreground mb-1 block">
							Next Step
						</label>
						<select
							value={editedStep.nextStep || ""}
							onChange={(e) =>
								setEditedStep({
									...editedStep,
									nextStep: e.target.value || null,
								})
							}
							className="w-full px-3 py-2 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
						>
							<option value="">None (End workflow)</option>
							{availableNextSteps.map((stepName) => (
								<option key={stepName} value={stepName}>
									{stepName.replace(/_/g, " ")}
								</option>
							))}
						</select>
						<p className="text-xs text-muted-foreground mt-1">
							{editedStep.type === "decision"
								? "Decision nodes can have conditional branches (configured in code)"
								: "The step that executes after this one completes"}
						</p>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="p-4 border-t border-white/10 flex gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={handleSave}
					className="flex-1 border-green-500/30 hover:bg-green-500/10 text-green-400"
				>
					<Save className="h-4 w-4 mr-2" />
					Save Changes
				</Button>
				<Button variant="outline" size="sm" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</GlassPanel>
	);
}
