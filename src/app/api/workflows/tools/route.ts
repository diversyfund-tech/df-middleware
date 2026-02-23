/**
 * Tools API
 * 
 * GET /api/workflows/tools?workflowType=sales
 * List available MCP tools for workflow type
 */

import { NextRequest, NextResponse } from "next/server";
import { getToolsForWorkflow, getAllTools } from "@/lib/mcp/tool-registry";
import type { WorkflowType } from "@/lib/workflows/types";

export async function GET(req: NextRequest) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const workflowType = searchParams.get("workflowType") as WorkflowType | null;

		const tools = workflowType
			? await getToolsForWorkflow(workflowType)
			: await getAllTools();

		return NextResponse.json({
			tools: tools.map(tool => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
			})),
			count: tools.length,
			workflowType: workflowType || "all",
		});
	} catch (error: any) {
		console.error("[workflows.tools] Error listing tools:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
