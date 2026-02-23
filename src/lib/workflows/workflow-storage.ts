/**
 * Workflow Storage
 * 
 * CRUD operations for workflow definitions in the database.
 */

import { db } from "@/server/db";
import { workflowDefinitions } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { WorkflowDefinition } from "./types";

export interface CreateWorkflowDefinitionInput {
	name: string;
	workflowType: WorkflowDefinition["type"];
	description?: string;
	steps: WorkflowDefinition["steps"];
	initialStep: string;
	createdBy?: string;
	isActive?: boolean;
}

export interface UpdateWorkflowDefinitionInput {
	name?: string;
	description?: string;
	steps?: WorkflowDefinition["steps"];
	initialStep?: string;
	isActive?: boolean;
}

/**
 * Create a new workflow definition
 */
export async function createWorkflowDefinition(
	input: CreateWorkflowDefinitionInput
) {
	const [workflow] = await db
		.insert(workflowDefinitions)
		.values({
			name: input.name,
			workflowType: input.workflowType,
			description: input.description || null,
			steps: input.steps as any,
			initialStep: input.initialStep,
			createdBy: input.createdBy || null,
			isActive: input.isActive ?? true,
		})
		.returning();

	return workflow;
}

/**
 * Get workflow definition by ID
 */
export async function getWorkflowDefinitionById(id: string) {
	const [workflow] = await db
		.select()
		.from(workflowDefinitions)
		.where(eq(workflowDefinitions.id, id))
		.limit(1);

	return workflow || null;
}

/**
 * Get workflow definition by name
 */
export async function getWorkflowDefinitionByName(name: string) {
	const [workflow] = await db
		.select()
		.from(workflowDefinitions)
		.where(eq(workflowDefinitions.name, name))
		.limit(1);

	return workflow || null;
}

/**
 * List workflow definitions
 */
export async function listWorkflowDefinitions(options?: {
	workflowType?: WorkflowDefinition["type"];
	isActive?: boolean;
	createdBy?: string;
	limit?: number;
	offset?: number;
}) {
	let query = db.select().from(workflowDefinitions);

	const conditions = [];
	if (options?.workflowType) {
		conditions.push(eq(workflowDefinitions.workflowType, options.workflowType));
	}
	if (options?.isActive !== undefined) {
		conditions.push(eq(workflowDefinitions.isActive, options.isActive));
	}
	if (options?.createdBy) {
		conditions.push(eq(workflowDefinitions.createdBy, options.createdBy));
	}

	if (conditions.length > 0) {
		query = query.where(and(...conditions)) as any;
	}

	query = query.orderBy(desc(workflowDefinitions.createdAt)) as any;

	if (options?.limit) {
		query = query.limit(options.limit) as any;
	}
	if (options?.offset) {
		query = query.offset(options.offset) as any;
	}

	return await query;
}

/**
 * Update workflow definition
 */
export async function updateWorkflowDefinition(
	id: string,
	input: UpdateWorkflowDefinitionInput
) {
	const [workflow] = await db
		.update(workflowDefinitions)
		.set({
			...input,
			updatedAt: new Date(),
		})
		.where(eq(workflowDefinitions.id, id))
		.returning();

	return workflow || null;
}

/**
 * Delete workflow definition
 */
export async function deleteWorkflowDefinition(id: string) {
	const [workflow] = await db
		.delete(workflowDefinitions)
		.where(eq(workflowDefinitions.id, id))
		.returning();

	return workflow || null;
}

/**
 * Get workflow definitions by type
 */
export async function getWorkflowDefinitionsByType(
	workflowType: WorkflowDefinition["type"]
) {
	return await db
		.select()
		.from(workflowDefinitions)
		.where(
			and(
				eq(workflowDefinitions.workflowType, workflowType),
				eq(workflowDefinitions.isActive, true)
			)
		)
		.orderBy(desc(workflowDefinitions.createdAt));
}

/**
 * Update workflow from canvas state
 * Helper function for syncing React Flow canvas changes to workflow definition
 */
export async function updateWorkflowFromCanvas(
	id: string,
	workflow: WorkflowDefinition
) {
	return await updateWorkflowDefinition(id, {
		steps: workflow.steps,
		initialStep: workflow.initialStep,
		name: workflow.name,
		description: workflow.description,
	});
}
