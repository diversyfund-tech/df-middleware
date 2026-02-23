/**
 * Tool Selector Component
 * 
 * MCP tool picker with search and category grouping.
 */

"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import GlassPanel from "@/components/ui/GlassPanel";

interface MCPTool {
	name: string;
	description: string;
	inputSchema?: {
		type?: string;
		properties?: Record<string, unknown>;
		required?: string[];
	};
}

interface ToolSelectorProps {
	selectedTool?: string;
	onToolSelect: (toolName: string) => void;
	workflowType?: string;
	className?: string;
}

export default function ToolSelector({
	selectedTool,
	onToolSelect,
	workflowType,
	className,
}: ToolSelectorProps) {
	const [tools, setTools] = useState<MCPTool[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		async function loadTools() {
			setIsLoading(true);
			try {
				const response = await fetch(
					`/api/workflows/tools${workflowType ? `?workflowType=${workflowType}` : ""}`
				);
				if (response.ok) {
					const data = await response.json();
					setTools(data.tools || []);
				}
			} catch (error) {
				console.error("[ToolSelector] Failed to load tools:", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadTools();
	}, [workflowType]);

	const filteredTools = tools.filter(
		(tool) =>
			!searchQuery ||
			tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tool.description.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Group tools by category (extract from tool name prefix)
	const groupedTools = filteredTools.reduce((acc, tool) => {
		const category = tool.name.split("_")[0] || "other";
		if (!acc[category]) {
			acc[category] = [];
		}
		acc[category].push(tool);
		return acc;
	}, {} as Record<string, MCPTool[]>);

	return (
		<div className={cn("space-y-2", className)}>
			<div className="relative">
				<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Search tools..."
					className="w-full pl-8 pr-3 py-2 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
				/>
			</div>

			{isLoading ? (
				<div className="p-4 text-center text-sm text-muted-foreground">Loading tools...</div>
			) : filteredTools.length === 0 ? (
				<div className="p-4 text-center text-sm text-muted-foreground">
					{searchQuery ? "No tools found" : "No tools available"}
				</div>
			) : (
				<div className="max-h-[300px] overflow-y-auto space-y-3">
					{Object.entries(groupedTools).map(([category, categoryTools]) => (
						<div key={category}>
							<div className="text-xs font-medium text-muted-foreground mb-1 uppercase">
								{category}
							</div>
							<div className="space-y-1">
								{categoryTools.map((tool) => (
									<button
										key={tool.name}
										onClick={() => onToolSelect(tool.name)}
										className={cn(
											"w-full text-left p-2 rounded-lg border transition-colors",
											selectedTool === tool.name
												? "border-cyan-500/50 bg-cyan-500/10"
												: "border-white/10 bg-white/5 hover:bg-white/10"
										)}
									>
										<div className="text-xs font-mono text-cyan-400 truncate">{tool.name}</div>
										<div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
											{tool.description}
										</div>
									</button>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
