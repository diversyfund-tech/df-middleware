/**
 * Workflow Definitions API
 * 
 * CRUD endpoints for workflow definitions.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	createWorkflowDefinition,
	listWorkflowDefinitions,
	type CreateWorkflowDefinitionInput,
} from "@/lib/workflows/workflow-storage";
import { validateWorkflow } from "@/lib/workflows/workflow-validator";
import type { WorkflowDefinition } from "@/lib/workflows/types";

export const runtime = "nodejs";

/**
 * GET /api/workflows/definitions
 * List workflow definitions
 */
export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const workflowType = searchParams.get("workflowType") as
			| WorkflowDefinition["type"]
			| null;
		const isActive = searchParams.get("isActive");
		const createdBy = searchParams.get("createdBy");
		const limit = searchParams.get("limit");
		const offset = searchParams.get("offset");

		const workflows = await listWorkflowDefinitions({
			workflowType: workflowType || undefined,
			isActive: isActive ? isActive === "true" : undefined,
			createdBy: createdBy || undefined,
			limit: limit ? parseInt(limit, 10) : undefined,
			offset: offset ? parseInt(offset, 10) : undefined,
		});

		return NextResponse.json({ workflows });
	} catch (error: any) {
		console.error("[workflows/definitions] GET Error:", error);
		return NextResponse.json(
			{ error: "Failed to list workflow definitions", message: error.message },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/workflows/definitions
 * Create a new workflow definition
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const {
			name,
			workflowType,
			description,
			steps,
			initialStep,
			createdBy,
			isActive,
		} = body as CreateWorkflowDefinitionInput & { workflowType: WorkflowDefinition["type"] };

		// Validate required fields
		if (!name || !workflowType || !steps || !initialStep) {
			return NextResponse.json(
				{
					error: "Missing required fields",
					required: ["name", "workflowType", "steps", "initialStep"],
				},
				{ status: 400 }
			);
		}

		// Create workflow definition object for validation
		const workflow: WorkflowDefinition = {
			type: workflowType,
			name,
			description: description || "",
			initialStep,
			steps,
		};

		// Validate workflow
		const validation = await validateWorkflow(workflow);
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

		// Create workflow definition
		const created = await createWorkflowDefinition({
			name,
			workflowType,
			description,
			steps,
			initialStep,
			createdBy,
			isActive,
		});

		return NextResponse.json({ workflow: created }, { status: 201 });
	} catch (error: any) {
		console.error("[workflows/definitions] POST Error:", error);
		return NextResponse.json(
			{ error: "Failed to create workflow definition", message: error.message },
			{ status: 500 }
		);
	}
}
