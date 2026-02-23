/**
 * Custom Workflow Node Component
 * 
 * Custom node component for react-flow that displays workflow steps
 */

import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { WorkflowNodeData } from "@/lib/workflows/visualization";
import { getNodeColor, getNodeIcon } from "@/lib/workflows/visualization";
import { cn } from "@/lib/utils";

export default function WorkflowNode({ data, selected }: NodeProps<WorkflowNodeData>) {
	const { stepName, stepType, description, toolName } = data;
	const color = getNodeColor(stepType);
	const icon = getNodeIcon(stepType);

	return (
		<div
			className={cn(
				"px-4 py-3 rounded-lg border-2 shadow-lg min-w-[180px] max-w-[220px]",
				color,
				selected ? "border-cyan-400 ring-2 ring-cyan-400/50" : "border-white/20",
				"bg-white/10 backdrop-blur-sm"
			)}
		>
			<Handle type="target" position={Position.Top} className="w-3 h-3 bg-cyan-400" />
			
			<div className="flex items-start gap-2 mb-2">
				<span className="text-lg">{icon}</span>
				<div className="flex-1 min-w-0">
					<div className="font-semibold text-sm text-white mb-1 truncate">
						{stepName.replace(/_/g, " ")}
					</div>
					<div className="text-xs text-white/80 line-clamp-2">
						{description}
					</div>
					{toolName && (
						<div className="mt-1 text-xs font-mono text-white/60 truncate">
							{toolName}
						</div>
					)}
				</div>
			</div>

			<Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-cyan-400" />
		</div>
	);
}
