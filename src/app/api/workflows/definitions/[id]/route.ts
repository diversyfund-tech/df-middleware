/**
 * Workflow Definition by ID API
 * 
 * Get, update, and delete specific workflow definitions.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	getWorkflowDefinitionById,
	updateWorkflowDefinition,
	deleteWorkflowDefinition,
	type UpdateWorkflowDefinitionInput,
} from "@/lib/workflows/workflow-storage";
import { validateWorkflow } from "@/lib/workflows/workflow-validator";
import type { WorkflowDefinition } from "@/lib/workflows/types";

export const runtime = "nodejs";

/**
 * GET /api/workflows/definitions/[id]
 * Get workflow definition by ID
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const { id } = params;

		const workflow = await getWorkflowDefinitionById(id);

		if (!workflow) {
			return NextResponse.json(
				{ error: "Workflow definition not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ workflow });
	} catch (error: any) {
		console.error("[workflows/definitions/[id]] GET Error:", error);
		return NextResponse.json(
			{ error: "Failed to get workflow definition", message: error.message },
			{ status: 500 }
		);
	}
}

/**
 * PUT /api/workflows/definitions/[id]
 * Update workflow definition
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const { id } = params;
		const body = await request.json();
		const updateData = body as UpdateWorkflowDefinitionInput;

		// Get existing workflow
		const existing = await getWorkflowDefinitionById(id);
		if (!existing) {
			return NextResponse.json(
				{ error: "Workflow definition not found" },
				{ status: 404 }
			);
		}

		// Merge updates with existing data
		const updatedWorkflow: WorkflowDefinition = {
			type: existing.workflowType as WorkflowDefinition["type"],
			name: updateData.name || existing.name,
			description: updateData.description || existing.description || "",
			initialStep: updateData.initialStep || existing.initialStep,
			steps: (updateData.steps as WorkflowDefinition["steps"]) || existing.steps as WorkflowDefinition["steps"],
		};

		// Validate updated workflow
		const validation = await validateWorkflow(updatedWorkflow);
		if (!validation.valid) {
			return NextResponse.json(
				{
					error: "Workflow validation failed",
					errors: validation.errors,
					warnings: validation.warnings,
				},
				{ status: 400 }
			);
		}

		// Update workflow
		const updated = await updateWorkflowDefinition(id, updateData);

		if (!updated) {
			return NextResponse.json(
				{ error: "Failed to update workflow definition" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ workflow: updated });
	} catch (error: any) {
		console.error("[workflows/definitions/[id]] PUT Error:", error);
		return NextResponse.json(
			{ error: "Failed to update workflow definition", message: error.message },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/workflows/definitions/[id]
 * Delete workflow definition
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const { id } = params;

		const deleted = await deleteWorkflowDefinition(id);

		if (!deleted) {
			return NextResponse.json(
				{ error: "Workflow definition not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ success: true, workflow: deleted });
	} catch (error: any) {
		console.error("[workflows/definitions/[id]] DELETE Error:", error);
		return NextResponse.json(
			{ error: "Failed to delete workflow definition", message: error.message },
			{ status: 500 }
		);
	}
}
