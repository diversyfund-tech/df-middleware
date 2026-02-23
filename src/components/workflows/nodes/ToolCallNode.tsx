/**
 * Tool Call Node Component
 * 
 * Specialized node component for tool_call step type.
 */

import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { WorkflowNodeData } from "@/lib/workflows/visualization";
import { cn } from "@/lib/utils";

export default function ToolCallNode({ data, selected }: NodeProps<WorkflowNodeData>) {
	const { stepName, description, toolName, requiredData } = data;
	const requiredCount = requiredData?.length || 0;

	return (
		<div
			className={cn(
				"px-4 py-3 rounded-lg border-2 shadow-lg min-w-[200px] max-w-[240px]",
				"bg-green-500/20 backdrop-blur-sm",
				selected ? "border-green-400 ring-2 ring-green-400/50" : "border-green-500/30"
			)}
		>
			<Handle type="target" position={Position.Top} className="w-3 h-3 bg-green-400" />

			<div className="flex items-start gap-2">
				<span className="text-xl flex-shrink-0">🔧</span>
				<div className="flex-1 min-w-0">
					<div className="font-semibold text-sm text-white mb-1 truncate">
						{stepName.replace(/_/g, " ")}
					</div>
					{toolName && (
						<div className="text-xs font-mono text-green-300 mb-1 truncate">{toolName}</div>
					)}
					<div className="text-xs text-white/80 line-clamp-2 mb-2">{description}</div>
					{requiredCount > 0 && (
						<div className="flex items-center gap-1 text-xs text-green-200">
							<span>Needs:</span>
							<span className="font-medium">{requiredCount} input{requiredCount !== 1 ? "s" : ""}</span>
						</div>
					)}
				</div>
			</div>

			<Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-400" />
		</div>
	);
}
