/**
 * Workflow Step Editor Component
 * 
 * Inline editor for editing workflow step details.
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import GlassPanel from "@/components/ui/GlassPanel";
import { Save, X, Trash2 } from "lucide-react";
import type { WorkflowStepDefinition } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

interface WorkflowStepEditorProps {
	step: WorkflowStepDefinition;
	stepIndex: number;
	onSave: (step: WorkflowStepDefinition) => void;
	onCancel: () => void;
	onDelete?: () => void;
	allSteps: WorkflowStepDefinition[];
}

export default function WorkflowStepEditor({
	step,
	stepIndex,
	onSave,
	onCancel,
	onDelete,
	allSteps,
}: WorkflowStepEditorProps) {
	const [editedStep, setEditedStep] = useState<WorkflowStepDefinition>({ ...step });
	const [isEditing, setIsEditing] = useState(false);

	useEffect(() => {
		setEditedStep({ ...step });
	}, [step]);

	const handleSave = () => {
		onSave(editedStep);
		setIsEditing(false);
	};

	const handleCancel = () => {
		setEditedStep({ ...step });
		setIsEditing(false);
		onCancel();
	};

	const stepTypes: Array<{ value: WorkflowStepDefinition["type"]; label: string }> = [
		{ value: "collect_info", label: "Collect Info" },
		{ value: "tool_call", label: "Tool Call" },
		{ value: "decision", label: "Decision" },
		{ value: "complete", label: "Complete" },
	];

	const availableNextSteps = allSteps
		.filter((s) => s.name !== editedStep.name)
		.map((s) => s.name);

	return (
		<GlassPanel
			variant="default"
			className="p-4 border-cyan-500/30 shadow-[0_0_15px_rgba(0,150,255,0.2)]"
		>
			<div className="space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<h4 className="font-semibold text-sm">Edit Step: {step.name}</h4>
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
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCancel}
							className="text-zinc-400 hover:text-zinc-300"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Step Name */}
				<div>
					<label className="text-xs font-medium text-muted-foreground mb-1 block">
						Step Name
					</label>
					<input
						type="text"
						value={editedStep.name}
						onChange={(e) =>
							setEditedStep({ ...editedStep, name: e.target.value })
						}
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
						className="w-full min-h-[60px] bg-background/50 backdrop-blur-sm border border-white/20 focus:ring-2 focus:ring-cyan-500/50 text-sm"
						placeholder="What does this step do?"
					/>
				</div>

				{/* Tool Name (for tool_call steps) */}
				{editedStep.type === "tool_call" && (
					<div>
						<label className="text-xs font-medium text-muted-foreground mb-1 block">
							Tool Name
						</label>
						<input
							type="text"
							value={editedStep.toolName || ""}
							onChange={(e) =>
								setEditedStep({ ...editedStep, toolName: e.target.value || undefined })
							}
							className="w-full px-3 py-2 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm font-mono"
							placeholder="comms_contacts_create"
						/>
					</div>
				)}

				{/* Required Data */}
				<div>
					<label className="text-xs font-medium text-muted-foreground mb-1 block">
						Required Data (comma-separated)
					</label>
					<input
						type="text"
						value={editedStep.requiredData?.join(", ") || ""}
						onChange={(e) =>
							setEditedStep({
								...editedStep,
								requiredData: e.target.value
									.split(",")
									.map((s) => s.trim())
									.filter(Boolean),
							})
						}
						className="w-full px-3 py-2 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
						placeholder="firstName, lastName, email"
					/>
				</div>

				{/* Next Step */}
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
								{stepName}
							</option>
						))}
					</select>
				</div>

				{/* Actions */}
				<div className="flex gap-2 pt-2 border-t border-white/10">
					<Button
						variant="outline"
						size="sm"
						onClick={handleSave}
						className="flex-1 border-green-500/30 hover:bg-green-500/10 text-green-400"
					>
						<Save className="h-4 w-4 mr-2" />
						Save Changes
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleCancel}
						className="border-zinc-500/30 hover:bg-zinc-500/10"
					>
						Cancel
					</Button>
				</div>
			</div>
		</GlassPanel>
	);
}
