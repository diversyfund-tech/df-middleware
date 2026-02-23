/**
 * Node Palette Component
 * 
 * Sidebar with draggable node types and MCP tool browser.
 * Inspired by Flowise's node palette.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import GlassPanel from "@/components/ui/GlassPanel";
import type { StepType } from "@/lib/workflows/types";
import { Search, ChevronDown, ChevronRight, GripVertical } from "lucide-react";

export interface NodePaletteItem {
	id: string;
	type: StepType | "tool_call";
	label: string;
	description: string;
	icon: string;
	category: string;
	toolName?: string; // For tool_call items
}

interface NodePaletteProps {
	onNodeDragStart?: (nodeType: StepType, toolName?: string) => void;
	workflowType?: string;
	className?: string;
}

const BASE_NODE_TYPES: Omit<NodePaletteItem, "id">[] = [
	{
		type: "collect_info",
		label: "Collect Info",
		description: "Gather information from the user",
		icon: "📝",
		category: "Core Steps",
	},
	{
		type: "tool_call",
		label: "Tool Call",
		description: "Execute an MCP tool",
		icon: "🔧",
		category: "Core Steps",
	},
	{
		type: "decision",
		label: "Decision",
		description: "Branch workflow based on conditions",
		icon: "❓",
		category: "Core Steps",
	},
	{
		type: "complete",
		label: "Complete",
		description: "End the workflow",
		icon: "✅",
		category: "Core Steps",
	},
];

export default function NodePalette({
	onNodeDragStart,
	workflowType,
	className,
}: NodePaletteProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
		new Set(["Core Steps", "MCP Tools"])
	);
	const [tools, setTools] = useState<Array<{ name: string; description: string }>>([]);
	const [isLoadingTools, setIsLoadingTools] = useState(false);

	// Load MCP tools
	useEffect(() => {
		async function loadTools() {
			setIsLoadingTools(true);
			try {
				const response = await fetch(
					`/api/workflows/tools${workflowType ? `?workflowType=${workflowType}` : ""}`
				);
				if (response.ok) {
					const data = await response.json();
					setTools(data.tools || []);
				}
			} catch (error) {
				console.error("[NodePalette] Failed to load tools:", error);
			} finally {
				setIsLoadingTools(false);
			}
		}
		loadTools();
	}, [workflowType]);

	const toggleCategory = useCallback((category: string) => {
		setExpandedCategories((prev) => {
			const next = new Set(prev);
			if (next.has(category)) {
				next.delete(category);
			} else {
				next.add(category);
			}
			return next;
		});
	}, []);

	const filteredTools = tools.filter(
		(tool) =>
			!searchQuery ||
			tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tool.description.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const handleDragStart = useCallback(
		(e: React.DragEvent, nodeType: StepType, toolName?: string) => {
			e.dataTransfer.setData("application/reactflow", JSON.stringify({ nodeType, toolName }));
			e.dataTransfer.effectAllowed = "move";
			onNodeDragStart?.(nodeType, toolName);
		},
		[onNodeDragStart]
	);

	const baseNodes = BASE_NODE_TYPES.filter(
		(node) =>
			!searchQuery ||
			node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
			node.description.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<GlassPanel
			variant="default"
			className={cn("h-full flex flex-col overflow-hidden", className)}
		>
			{/* Header */}
			<div className="p-4 border-b border-white/10">
				<h3 className="text-lg font-semibold mb-2">Node Palette</h3>
				<div className="relative">
					<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search nodes..."
						className="w-full pl-8 pr-3 py-2 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
					/>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-2">
				{/* Core Steps */}
				<div className="mb-4">
					<button
						onClick={() => toggleCategory("Core Steps")}
						className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors"
					>
						<span className="text-sm font-medium">Core Steps</span>
						{expandedCategories.has("Core Steps") ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</button>
					{expandedCategories.has("Core Steps") && (
						<div className="mt-2 space-y-1">
							{baseNodes.map((node) => (
								<div
									key={node.type}
									draggable
									onDragStart={(e) => handleDragStart(e, node.type as StepType)}
									className="flex items-start gap-2 p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors"
								>
									<GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
									<span className="text-lg flex-shrink-0">{node.icon}</span>
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium truncate">{node.label}</div>
										<div className="text-xs text-muted-foreground line-clamp-2">
											{node.description}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* MCP Tools */}
				<div>
					<button
						onClick={() => toggleCategory("MCP Tools")}
						className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors"
					>
						<span className="text-sm font-medium">
							MCP Tools {tools.length > 0 && `(${filteredTools.length})`}
						</span>
						{expandedCategories.has("MCP Tools") ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</button>
					{expandedCategories.has("MCP Tools") && (
						<div className="mt-2 space-y-1">
							{isLoadingTools ? (
								<div className="p-4 text-center text-sm text-muted-foreground">
									Loading tools...
								</div>
							) : filteredTools.length === 0 ? (
								<div className="p-4 text-center text-sm text-muted-foreground">
									{searchQuery ? "No tools found" : "No tools available"}
								</div>
							) : (
								filteredTools.map((tool) => (
									<div
										key={tool.name}
										draggable
										onDragStart={(e) => handleDragStart(e, "tool_call", tool.name)}
										className="flex items-start gap-2 p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors"
									>
										<GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
										<span className="text-lg flex-shrink-0">🔧</span>
										<div className="flex-1 min-w-0">
											<div className="text-xs font-mono text-cyan-400 truncate">
												{tool.name}
											</div>
											<div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
												{tool.description}
											</div>
										</div>
									</div>
								))
							)}
						</div>
					)}
				</div>
			</div>
		</GlassPanel>
	);
}
