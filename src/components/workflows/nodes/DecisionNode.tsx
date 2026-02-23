/**
 * Decision Node Component
 * 
 * Specialized node component for decision step type.
 */

import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { WorkflowNodeData } from "@/lib/workflows/visualization";
import { cn } from "@/lib/utils";

export default function DecisionNode({ data, selected }: NodeProps<WorkflowNodeData>) {
	const { stepName, description } = data;

	return (
		<div
			className={cn(
				"px-4 py-3 rounded-lg border-2 shadow-lg min-w-[200px] max-w-[240px]",
				"bg-yellow-500/20 backdrop-blur-sm",
				selected ? "border-yellow-400 ring-2 ring-yellow-400/50" : "border-yellow-500/30"
			)}
		>
			<Handle type="target" position={Position.Top} className="w-3 h-3 bg-yellow-400" />

			<div className="flex items-start gap-2">
				<span className="text-xl flex-shrink-0">❓</span>
				<div className="flex-1 min-w-0">
					<div className="font-semibold text-sm text-white mb-1 truncate">
						{stepName.replace(/_/g, " ")}
					</div>
					<div className="text-xs text-white/80 line-clamp-2 mb-2">{description}</div>
					<div className="text-xs text-yellow-200 italic">Branches workflow</div>
				</div>
			</div>

			<Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-yellow-400" />
		</div>
	);
}
