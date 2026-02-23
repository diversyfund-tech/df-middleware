/**
 * Workflow Registry
 * 
 * Central registry for all workflow definitions with support for
 * discovery, versioning, and composition.
 */

import type { WorkflowDefinition, WorkflowType } from "./types";
import { getSyncWorkflow, listSyncWorkflows } from "./sync-workflows";
import { salesWorkflow } from "./sales-workflow";
import { supportWorkflow } from "./support-workflow";
import { appointmentWorkflow } from "./appointment-workflow";
import { getBusinessProcessWorkflow, listBusinessProcessWorkflows } from "./business-processes";

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
	id: string;
	name: string;
	description: string;
	type: WorkflowType;
	version: string;
	tags: string[];
	category: "sync" | "voice_agent" | "business_process" | "custom";
	author?: string;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Registered workflow entry
 */
export interface RegisteredWorkflow {
	metadata: WorkflowMetadata;
	definition: WorkflowDefinition;
}

/**
 * Workflow registry
 */
class WorkflowRegistry {
	private workflows: Map<string, RegisteredWorkflow> = new Map();
	private versions: Map<string, RegisteredWorkflow[]> = new Map(); // workflowId -> versions

	/**
	 * Register a workflow
	 */
	register(workflow: WorkflowDefinition, metadata: Partial<WorkflowMetadata> = {}): string {
		const id = metadata.id || `${workflow.type}_${workflow.name.toLowerCase().replace(/\s+/g, "_")}`;
		const version = metadata.version || "1.0.0";
		const fullId = `${id}_v${version}`;

		const workflowMetadata: WorkflowMetadata = {
			id,
			name: workflow.name,
			description: workflow.description,
			type: workflow.type,
			version,
			tags: metadata.tags || [],
			category: this.inferCategory(workflow.type),
			author: metadata.author,
			createdAt: metadata.createdAt || new Date(),
			updatedAt: metadata.updatedAt || new Date(),
		};

		const registered: RegisteredWorkflow = {
			metadata: workflowMetadata,
			definition: workflow,
		};

		this.workflows.set(fullId, registered);

		// Track versions
		if (!this.versions.has(id)) {
			this.versions.set(id, []);
		}
		this.versions.get(id)!.push(registered);

		return fullId;
	}

	/**
	 * Get workflow by ID
	 */
	get(workflowId: string, version?: string): RegisteredWorkflow | null {
		const fullId = version ? `${workflowId}_v${version}` : workflowId;
		return this.workflows.get(fullId) || null;
	}

	/**
	 * Get latest version of a workflow
	 */
	getLatest(workflowId: string): RegisteredWorkflow | null {
		const versions = this.versions.get(workflowId);
		if (!versions || versions.length === 0) {
			return null;
		}

		// Sort by version (semantic versioning)
		versions.sort((a, b) => {
			const aVersion = a.metadata.version.split(".").map(Number);
			const bVersion = b.metadata.version.split(".").map(Number);
			
			for (let i = 0; i < Math.max(aVersion.length, bVersion.length); i++) {
				const aVal = aVersion[i] || 0;
				const bVal = bVersion[i] || 0;
				if (aVal !== bVal) {
					return bVal - aVal; // Descending order
				}
			}
			return 0;
		});

		return versions[0];
	}

	/**
	 * Search workflows
	 */
	search(query: {
		type?: WorkflowType;
		category?: "sync" | "voice_agent" | "business_process" | "custom";
		tags?: string[];
		searchTerm?: string;
	}): RegisteredWorkflow[] {
		let results = Array.from(this.workflows.values());

		// Filter by type
		if (query.type) {
			results = results.filter(w => w.metadata.type === query.type);
		}

		// Filter by category
		if (query.category) {
			results = results.filter(w => w.metadata.category === query.category);
		}

		// Filter by tags
		if (query.tags && query.tags.length > 0) {
			results = results.filter(w =>
				query.tags!.some(tag => w.metadata.tags.includes(tag))
			);
		}

		// Filter by search term
		if (query.searchTerm) {
			const term = query.searchTerm.toLowerCase();
			results = results.filter(w =>
				w.metadata.name.toLowerCase().includes(term) ||
				w.metadata.description.toLowerCase().includes(term)
			);
		}

		return results;
	}

	/**
	 * List all workflows
	 */
	list(): RegisteredWorkflow[] {
		// Return only latest versions
		const latestVersions = new Map<string, RegisteredWorkflow>();
		
		for (const [id, versions] of this.versions.entries()) {
			const latest = this.getLatest(id);
			if (latest) {
				latestVersions.set(id, latest);
			}
		}

		return Array.from(latestVersions.values());
	}

	/**
	 * Get workflow versions
	 */
	getVersions(workflowId: string): RegisteredWorkflow[] {
		return this.versions.get(workflowId) || [];
	}

	/**
	 * Infer category from workflow type
	 */
	private inferCategory(type: WorkflowType): "sync" | "voice_agent" | "business_process" | "custom" {
		if (type === "sync") {
			return "sync";
		}
		if (type === "sales" || type === "support" || type === "appointment" || type === "voice_agent") {
			return "voice_agent";
		}
		if (type === "business_process") {
			return "business_process";
		}
		return "custom";
	}
}

// Create singleton registry instance
const registry = new WorkflowRegistry();

/**
 * Initialize registry with built-in workflows
 */
export function initializeWorkflowRegistry(): void {
	// Register sync workflows
	for (const syncWorkflow of listSyncWorkflows()) {
		const workflow = getSyncWorkflow(
			syncWorkflow.type as "contact" | "call" | "message" | "list",
			syncWorkflow.direction as any
		);
		registry.register(workflow, {
			id: `sync_${syncWorkflow.type}${syncWorkflow.direction ? `_${syncWorkflow.direction}` : ""}`,
			tags: ["sync", syncWorkflow.type],
			category: "sync",
		});
	}

	// Register voice agent workflows
	registry.register(salesWorkflow, {
		id: "voice_agent_sales",
		tags: ["voice_agent", "sales", "elevenlabs"],
		category: "voice_agent",
	});

	registry.register(supportWorkflow, {
		id: "voice_agent_support",
		tags: ["voice_agent", "support", "elevenlabs"],
		category: "voice_agent",
	});

	registry.register(appointmentWorkflow, {
		id: "voice_agent_appointment",
		tags: ["voice_agent", "appointment", "elevenlabs"],
		category: "voice_agent",
	});

	// Register business process workflows
	for (const bpWorkflow of listBusinessProcessWorkflows()) {
		const workflow = getBusinessProcessWorkflow(bpWorkflow.name);
		if (workflow) {
			registry.register(workflow, {
				id: `business_process_${bpWorkflow.name}`,
				tags: ["business_process", bpWorkflow.name],
				category: "business_process",
			});
		}
	}
}

/**
 * Register a custom workflow
 */
export function registerWorkflow(
	workflow: WorkflowDefinition,
	metadata?: Partial<WorkflowMetadata>
): string {
	return registry.register(workflow, metadata);
}

/**
 * Get workflow by ID
 */
export function getWorkflow(workflowId: string, version?: string): RegisteredWorkflow | null {
	return registry.get(workflowId, version);
}

/**
 * Get latest version of a workflow
 */
export function getLatestWorkflow(workflowId: string): RegisteredWorkflow | null {
	return registry.getLatest(workflowId);
}

/**
 * Search workflows
 */
export function searchWorkflows(query: {
	type?: WorkflowType;
	category?: "sync" | "voice_agent" | "business_process" | "custom";
	tags?: string[];
	searchTerm?: string;
}): RegisteredWorkflow[] {
	return registry.search(query);
}

/**
 * List all workflows
 */
export function listWorkflows(): RegisteredWorkflow[] {
	return registry.list();
}

/**
 * Get workflow versions
 */
export function getWorkflowVersions(workflowId: string): RegisteredWorkflow[] {
	return registry.getVersions(workflowId);
}

/**
 * Compose workflows - create a workflow that calls other workflows
 */
export function composeWorkflows(
	workflowIds: string[],
	name: string,
	description: string
): WorkflowDefinition {
	const steps: any[] = [];
	let currentStep: string | null = null;

	for (let i = 0; i < workflowIds.length; i++) {
		const workflowId = workflowIds[i];
		const workflow = registry.getLatest(workflowId);
		
		if (!workflow) {
			throw new Error(`Workflow ${workflowId} not found`);
		}

		// Add all steps from the workflow
		for (const step of workflow.definition.steps) {
			const stepName = `composed_${i}_${step.name}`;
			steps.push({
				...step,
				name: stepName,
				nextStep: step.nextStep ? `composed_${i}_${step.nextStep}` : undefined,
			});

			// Link to next workflow if this is the last step
			if (i === 0 && !currentStep) {
				currentStep = stepName;
			}
		}

		// Link workflows together
		if (i > 0 && currentStep) {
			const previousLastStep = steps[steps.length - 1];
			previousLastStep.nextStep = currentStep;
		}
	}

	return {
		type: "custom",
		name,
		description,
		steps,
		initialStep: steps[0]?.name || "start",
	};
}

// Initialize registry on module load
initializeWorkflowRegistry();
