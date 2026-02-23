/**
 * Workflow Export API
 * 
 * Export workflow definition as TypeScript code.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWorkflowDefinitionById } from "@/lib/workflows/workflow-storage";
import { generateWorkflowCode, validateGeneratedCode } from "@/lib/workflows/code-generator";
import type { WorkflowDefinition } from "@/lib/workflows/types";

export const runtime = "nodejs";

/**
 * POST /api/workflows/definitions/[id]/export
 * Export workflow as TypeScript code
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const { id } = params;

		const workflowRecord = await getWorkflowDefinitionById(id);

		if (!workflowRecord) {
			return NextResponse.json(
				{ error: "Workflow definition not found" },
				{ status: 404 }
			);
		}

		// Convert database record to WorkflowDefinition
		const workflow: WorkflowDefinition = {
			type: workflowRecord.workflowType as WorkflowDefinition["type"],
			name: workflowRecord.name,
			description: workflowRecord.description || "",
			initialStep: workflowRecord.initialStep,
			steps: workflowRecord.steps as WorkflowDefinition["steps"],
		};

		// Generate code
		const code = generateWorkflowCode(workflow);

		// Validate generated code
		const validation = validateGeneratedCode(code);
		if (!validation.valid) {
			return NextResponse.json(
				{
					error: "Generated code validation failed",
					errors: validation.errors,
				},
				{ status: 500 }
			);
		}

		// Generate filename
		const fileName = `${workflow.type}-${workflow.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-workflow.ts`;

		return NextResponse.json({
			code,
			fileName,
			workflow: {
				id: workflowRecord.id,
				name: workflow.name,
				type: workflow.type,
			},
		});
	} catch (error: any) {
		console.error("[workflows/definitions/[id]/export] POST Error:", error);
		return NextResponse.json(
			{ error: "Failed to export workflow", message: error.message },
			{ status: 500 }
		);
	}
}
