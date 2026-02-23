/**
 * Workflow Registry API Endpoint
 * 
 * Provides API for discovering, searching, and managing workflows.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	listWorkflows,
	searchWorkflows,
	getWorkflow,
	getLatestWorkflow,
	getWorkflowVersions,
	registerWorkflow,
} from "@/lib/workflows/registry";
import type { WorkflowType } from "@/lib/workflows/types";

/**
 * GET /api/workflows/registry
 * 
 * List or search workflows.
 * Query parameters:
 * - type: Filter by workflow type
 * - category: Filter by category (sync|voice_agent|business_process|custom)
 * - tags: Comma-separated list of tags
 * - search: Search term
 * - id: Get specific workflow by ID
 * - version: Get specific version (requires id)
 */
export async function GET(req: NextRequest) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const id = searchParams.get("id");
		const version = searchParams.get("version");
		const type = searchParams.get("type") as WorkflowType | null;
		const category = searchParams.get("category") as "sync" | "voice_agent" | "business_process" | "custom" | null;
		const tags = searchParams.get("tags")?.split(",").filter(Boolean);
		const searchTerm = searchParams.get("search");

		// Get specific workflow
		if (id) {
			const workflow = version ? getWorkflow(id, version) : getLatestWorkflow(id);
			if (!workflow) {
				return NextResponse.json(
					{ error: `Workflow ${id}${version ? ` v${version}` : ""} not found` },
					{ status: 404 }
				);
			}

			// If no version specified, also return all versions
			if (!version) {
				const versions = getWorkflowVersions(id);
				return NextResponse.json({
					workflow,
					versions: versions.map(v => ({
						version: v.metadata.version,
						updatedAt: v.metadata.updatedAt,
					})),
				});
			}

			return NextResponse.json({ workflow });
		}

		// Search workflows
		if (type || category || tags || searchTerm) {
			const results = searchWorkflows({
				type: type || undefined,
				category: category || undefined,
				tags: tags || undefined,
				searchTerm: searchTerm || undefined,
			});

			return NextResponse.json({
				workflows: results,
				total: results.length,
			});
		}

		// List all workflows
		const workflows = listWorkflows();
		return NextResponse.json({
			workflows,
			total: workflows.length,
		});
	} catch (error: any) {
		console.error("[workflow-registry] Error:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/workflows/registry
 * 
 * Register a new workflow.
 * Body:
 * {
 *   workflow: WorkflowDefinition;
 *   metadata?: Partial<WorkflowMetadata>;
 * }
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { workflow, metadata } = body;

		if (!workflow) {
			return NextResponse.json(
				{ error: "Workflow definition is required" },
				{ status: 400 }
			);
		}

		const workflowId = registerWorkflow(workflow, metadata);

		return NextResponse.json({
			success: true,
			workflowId,
			message: "Workflow registered successfully",
		});
	} catch (error: any) {
		console.error("[workflow-registry] Error:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
