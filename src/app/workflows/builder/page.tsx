/**
 * Workflow Builder Page
 * 
 * Main page for conversational workflow building with real-time visualization.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlassPanel from "@/components/ui/GlassPanel";
import WorkflowChat from "@/components/workflows/WorkflowChat";
import NodePalette from "@/components/workflows/builder/NodePalette";
import WorkflowCanvas from "@/components/workflows/builder/WorkflowCanvas";
import NodeConfigPanel from "@/components/workflows/builder/NodeConfigPanel";
import { parseWorkflowFromConversation } from "@/lib/workflows/conversation-parser";
import type { WorkflowDefinition, WorkflowStepDefinition } from "@/lib/workflows/types";
import { Button } from "@/components/ui/Button";
import { Loader2, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WorkflowBuilderPage() {
	const router = useRouter();
	const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
	const [selectedStep, setSelectedStep] = useState<string | undefined>();
	const [conversationMessages, setConversationMessages] = useState<
		Array<{ role: "user" | "assistant"; content: string }>
	>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [showChat, setShowChat] = useState(false);
	const [editingStep, setEditingStep] = useState<string | null>(null);

	// Parse workflow from conversation when it updates
	useEffect(() => {
		if (conversationMessages.length > 0) {
			const parsed = parseWorkflowFromConversation(conversationMessages);
			if (parsed.workflow) {
				console.log("[WorkflowBuilder] Parsed workflow from conversation:", parsed.workflow);
				setWorkflow(parsed.workflow);
			} else {
				console.log("[WorkflowBuilder] No workflow found in conversation yet");
			}
		}
	}, [conversationMessages]);

	const handleWorkflowUpdate = useCallback(
		(newWorkflow: WorkflowDefinition | null) => {
			if (newWorkflow) {
				setWorkflow(newWorkflow);
			}
		},
		[]
	);

	const handleWorkflowChange = useCallback(
		(updatedWorkflow: WorkflowDefinition) => {
			setWorkflow(updatedWorkflow);
		},
		[]
	);

	const handleNodeAdd = useCallback(() => {
		// Node was added, workflow state already updated
		// Could show a toast notification here
	}, []);

	const handleStepSave = useCallback(
		(updatedStep: WorkflowStepDefinition) => {
			if (!workflow) return;

			const updatedSteps = workflow.steps.map((s) =>
				s.name === updatedStep.name ? updatedStep : s
			);

			// Update nextStep references if step name changed
			if (updatedStep.name !== editingStep && editingStep) {
				const oldName = editingStep;
				const newName = updatedStep.name;
				updatedSteps.forEach((s) => {
					if (s.nextStep === oldName) {
						s.nextStep = newName;
					}
				});
				// Update initialStep if it was the renamed step
				const newInitialStep =
					workflow.initialStep === oldName ? newName : workflow.initialStep;
				setWorkflow({
					...workflow,
					steps: updatedSteps,
					initialStep: newInitialStep,
				});
			} else {
				setWorkflow({
					...workflow,
					steps: updatedSteps,
				});
			}

			setEditingStep(null);
		},
		[workflow, editingStep]
	);

	const handleStepDelete = useCallback(() => {
		if (!workflow || !editingStep) return;

		if (!confirm(`Are you sure you want to delete step "${editingStep}"?`)) {
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

		setWorkflow({
			...workflow,
			steps: updatedSteps,
			initialStep: newInitialStep,
		});

		setEditingStep(null);
	}, [workflow, editingStep]);

	const handlePreview = useCallback(async () => {
		if (conversationMessages.length === 0) {
			alert("No conversation to preview. Please chat with the AI first.");
			return;
		}

		setIsPreviewing(true);
		try {
			// First, try to parse workflow from current conversation
			const parsed = parseWorkflowFromConversation(conversationMessages);
			
			if (parsed.workflow) {
				console.log("[WorkflowBuilder] Preview parsed workflow:", parsed.workflow);
				setWorkflow(parsed.workflow);
				return; // Success, exit early
			}

			// If parsing failed, ask AI to generate a workflow definition
			console.log("[WorkflowBuilder] No workflow found in conversation, asking AI to generate one...");
			
			const response = await fetch("/api/workflows/builder", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [
						...conversationMessages,
						{
							role: "user" as const,
							content: `Based on our conversation, please generate a complete workflow definition in JSON format. 

The workflow definition must be a valid JSON object with this exact structure:
{
  "type": "sales" | "support" | "appointment" | "custom",
  "name": "Workflow Name",
  "description": "What this workflow does",
  "initialStep": "step_1",
  "steps": [
    {
      "name": "step_1",
      "type": "collect_info" | "tool_call" | "decision" | "complete",
      "description": "What this step does",
      "requiredData": [],
      "toolName": "tool_name_here" (only for tool_call steps),
      "nextStep": "step_2" or null
    }
  ]
}

Please provide ONLY the JSON workflow definition, wrapped in a code block like this:
\`\`\`json
{...}
\`\`\``,
						},
					],
					workflowType: workflow?.type || "custom",
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to generate preview: ${response.statusText} - ${errorText}`);
			}

			const data = await response.json();
			console.log("[WorkflowBuilder] AI response:", data);

			// Try to extract workflow from the new response
			const updatedMessages = [
				...conversationMessages,
				{ role: "assistant" as const, content: data.message },
			];
			const reParsed = parseWorkflowFromConversation(updatedMessages);

			if (reParsed.workflow || data.workflow) {
				const finalWorkflow = reParsed.workflow || data.workflow;
				console.log("[WorkflowBuilder] Preview generated workflow:", finalWorkflow);
				setWorkflow(finalWorkflow);
				// Don't show alert - let the visualization speak for itself
			} else {
				// Last resort: try to create a basic workflow from the conversation
				console.log("[WorkflowBuilder] Attempting to create basic workflow from conversation...");
				const basicWorkflow = createBasicWorkflowFromConversation(conversationMessages);
				if (basicWorkflow) {
					setWorkflow(basicWorkflow);
					console.log("[WorkflowBuilder] Created basic workflow:", basicWorkflow);
				} else {
					alert("Could not generate workflow preview. The AI may need more information. Try asking it to 'create a workflow definition in JSON format'.");
				}
			}
		} catch (error) {
			console.error("[WorkflowBuilder] Preview error:", error);
			alert(
				error instanceof Error ? error.message : "Failed to generate preview"
			);
		} finally {
			setIsPreviewing(false);
		}
	}, [conversationMessages, workflow?.type]);

	// Helper function to create a basic workflow from conversation as fallback
	const createBasicWorkflowFromConversation = useCallback((
		messages: Array<{ role: "user" | "assistant"; content: string }>
	): WorkflowDefinition | null => {
		// Extract workflow type from conversation
		const allText = messages.map(m => m.content).join(" ").toLowerCase();
		let workflowType: WorkflowDefinition["type"] = "custom";
		if (allText.includes("sales")) workflowType = "sales";
		else if (allText.includes("support")) workflowType = "support";
		else if (allText.includes("appointment")) workflowType = "appointment";

		// Create a simple workflow with basic steps
		const steps: WorkflowDefinition["steps"] = [
			{
				name: "start",
				type: "collect_info",
				description: "Start the workflow",
				nextStep: "collect_info",
			},
			{
				name: "collect_info",
				type: "collect_info",
				description: "Collect information from the user",
				nextStep: "process",
			},
			{
				name: "process",
				type: "tool_call",
				description: "Process the collected information",
				toolName: "comms_contacts_create",
				nextStep: "complete",
			},
			{
				name: "complete",
				type: "complete",
				description: "Workflow complete",
				nextStep: null,
			},
		];

		return {
			type: workflowType,
			name: `${workflowType.charAt(0).toUpperCase() + workflowType.slice(1)} Workflow`,
			description: "Workflow generated from conversation",
			initialStep: "start",
			steps,
		};
	}, []);

	const handleSave = useCallback(async () => {
		if (!workflow) {
			alert("No workflow to save. Please build a workflow first by chatting with the AI.");
			return;
		}

		setIsSaving(true);
		try {
			console.log("[WorkflowBuilder] Saving workflow:", workflow);

			const response = await fetch("/api/workflows/definitions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: workflow.name,
					workflowType: workflow.type,
					description: workflow.description,
					steps: workflow.steps,
					initialStep: workflow.initialStep,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				console.error("[WorkflowBuilder] Save error response:", error);
				throw new Error(error.message || error.error || "Failed to save workflow");
			}

			const data = await response.json();
			console.log("[WorkflowBuilder] Save success:", data);
			alert(`Workflow "${workflow.name}" saved successfully!`);
			
			// Redirect to workflows list
			router.push("/workflows");
		} catch (error) {
			console.error("[WorkflowBuilder] Save error:", error);
			alert(
				error instanceof Error ? error.message : "Failed to save workflow"
			);
		} finally {
			setIsSaving(false);
		}
	}, [workflow, router]);

	const handleExport = useCallback(async () => {
		if (!workflow) return;

		setIsExporting(true);
		try {
			// Generate code client-side
			const { generateWorkflowCode } = await import(
				"@/lib/workflows/code-generator"
			);
			const code = generateWorkflowCode(workflow);
			const blob = new Blob([code], { type: "text/typescript" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${workflow.type}-${workflow.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-workflow.ts`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("[WorkflowBuilder] Export error:", error);
			alert(
				error instanceof Error ? error.message : "Failed to export workflow"
			);
		} finally {
			setIsExporting(false);
		}
	}, [workflow]);

	const selectedStepData = workflow?.steps.find((s) => s.name === (editingStep || selectedStep));

	return (
		<div className="h-screen flex flex-col">
			{/* Header */}
			<div className="p-4 border-b border-white/10 bg-background/50 backdrop-blur-sm">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold">Workflow Builder</h1>
						<p className="text-sm text-muted-foreground">
							Drag nodes from palette • Click to configure • Connect with handles
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowChat(!showChat)}
							className="border-cyan-500/30 hover:bg-cyan-500/10"
						>
							<MessageSquare className="h-4 w-4 mr-2" />
							AI Assistant
						</Button>
						{workflow && (
							<>
								<Button
									variant="outline"
									onClick={handleSave}
									disabled={isSaving}
									className="border-green-500/30 hover:bg-green-500/10 text-green-400"
								>
									{isSaving ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Saving...
										</>
									) : (
										"Save Workflow"
									)}
								</Button>
								<Button
									variant="outline"
									onClick={handleExport}
									disabled={isExporting}
									className="border-cyan-500/30 hover:bg-cyan-500/10"
								>
									{isExporting ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Exporting...
										</>
									) : (
										"Export Code"
									)}
								</Button>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Three Panel Layout */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left Panel: Node Palette */}
				<div className="w-64 border-r border-white/10 flex-shrink-0">
					<NodePalette workflowType={workflow?.type} />
				</div>

				{/* Center Panel: Canvas */}
				<div className="flex-1 relative">
					<WorkflowCanvas
						workflow={workflow}
						selectedStep={editingStep || selectedStep}
						onStepSelect={(stepName) => {
							setSelectedStep(stepName);
							setEditingStep(stepName);
						}}
						onWorkflowChange={handleWorkflowChange}
						onNodeAdd={handleNodeAdd}
					/>
				</div>

				{/* Right Panel: Config Panel or Chat */}
				<div className="w-80 border-l border-white/10 flex-shrink-0">
					{showChat ? (
						<GlassPanel variant="default" className="h-full flex flex-col p-0">
							<div className="p-4 border-b border-white/10 flex items-center justify-between">
								<h2 className="text-lg font-semibold">AI Assistant</h2>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowChat(false)}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
							<WorkflowChat
								onWorkflowUpdate={handleWorkflowUpdate}
								onMessageUpdate={setConversationMessages}
								workflowType={workflow?.type}
							/>
						</GlassPanel>
					) : (
						<NodeConfigPanel
							step={selectedStepData || null}
							allSteps={workflow?.steps || []}
							workflow={workflow}
							onSave={handleStepSave}
							onCancel={() => {
								setEditingStep(null);
								setSelectedStep(undefined);
							}}
							onDelete={handleStepDelete}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
