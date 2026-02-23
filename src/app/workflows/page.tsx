/**
 * Workflows Management Page
 * 
 * List and manage all saved workflow definitions.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Plus,
	Edit,
	Trash2,
	Download,
	Loader2,
	Search,
	Filter,
} from "lucide-react";
import type { WorkflowDefinition } from "@/lib/workflows/types";

interface WorkflowRecord {
	id: string;
	name: string;
	workflowType: string;
	description: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export default function WorkflowsPage() {
	const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [filterType, setFilterType] = useState<string>("all");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	useEffect(() => {
		loadWorkflows();
	}, [filterType]);

	const loadWorkflows = async () => {
		setIsLoading(true);
		try {
			const params = new URLSearchParams();
			if (filterType !== "all") {
				params.append("workflowType", filterType);
			}
			params.append("isActive", "true");

			const response = await fetch(`/api/workflows/definitions?${params}`);
			if (!response.ok) {
				throw new Error("Failed to load workflows");
			}

			const data = await response.json();
			setWorkflows(data.workflows || []);
		} catch (error) {
			console.error("[WorkflowsPage] Error loading workflows:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async (id: string, name: string) => {
		if (!confirm(`Are you sure you want to delete "${name}"?`)) {
			return;
		}

		setDeletingId(id);
		try {
			const response = await fetch(`/api/workflows/definitions/${id}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete workflow");
			}

			// Reload workflows
			await loadWorkflows();
		} catch (error) {
			console.error("[WorkflowsPage] Error deleting workflow:", error);
			alert("Failed to delete workflow. Please try again.");
		} finally {
			setDeletingId(null);
		}
	};

	const handleExport = async (id: string, name: string) => {
		try {
			const response = await fetch(`/api/workflows/definitions/${id}/export`, {
				method: "POST",
			});

			if (!response.ok) {
				throw new Error("Failed to export workflow");
			}

			const data = await response.json();
			const blob = new Blob([data.code], { type: "text/typescript" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = data.fileName || `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-workflow.ts`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("[WorkflowsPage] Error exporting workflow:", error);
			alert("Failed to export workflow. Please try again.");
		}
	};

	const filteredWorkflows = workflows.filter((workflow) => {
		const matchesSearch =
			searchTerm === "" ||
			workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			workflow.description?.toLowerCase().includes(searchTerm.toLowerCase());
		return matchesSearch;
	});

	const workflowTypes: Array<{ value: string; label: string }> = [
		{ value: "all", label: "All Types" },
		{ value: "sales", label: "Sales" },
		{ value: "support", label: "Support" },
		{ value: "appointment", label: "Appointment" },
		{ value: "custom", label: "Custom" },
	];

	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-8 max-w-7xl">
				{/* Header */}
				<div className="mb-8 flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold mb-2 text-foreground">
							Workflows
						</h1>
						<p className="text-sm text-muted-foreground">
							Manage your ElevenLabs voice agent workflows
						</p>
					</div>
					<Link href="/workflows/builder">
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							Create Workflow
						</Button>
					</Link>
				</div>

				{/* Filters */}
				<Card className="mb-6">
					<CardContent className="pt-6">
						<div className="flex flex-col md:flex-row gap-4">
							<div className="flex-1 relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									type="text"
									placeholder="Search workflows..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-10"
								/>
							</div>
							<div className="flex items-center gap-2">
								<Filter className="h-4 w-4 text-muted-foreground" />
								<select
									value={filterType}
									onChange={(e) => setFilterType(e.target.value)}
									className="px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
								>
									{workflowTypes.map((type) => (
										<option key={type.value} value={type.value}>
											{type.label}
										</option>
									))}
								</select>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Workflows List */}
				{isLoading ? (
					<Card className="p-12 text-center">
						<CardContent>
							<Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
							<p className="text-sm text-muted-foreground">
								Loading workflows...
							</p>
						</CardContent>
					</Card>
				) : filteredWorkflows.length === 0 ? (
					<Card className="p-12 text-center">
						<CardContent>
							<p className="text-lg font-medium mb-2 text-foreground">
								No workflows found
							</p>
							<p className="text-sm text-muted-foreground mb-6">
								{searchTerm || filterType !== "all"
									? "Try adjusting your search or filters"
									: "Create your first workflow to get started"}
							</p>
							{!searchTerm && filterType === "all" && (
								<Link href="/workflows/builder">
									<Button>
										<Plus className="h-4 w-4 mr-2" />
										Create Workflow
									</Button>
								</Link>
							)}
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4">
						{filteredWorkflows.map((workflow) => (
							<Card
								key={workflow.id}
								className="hover:bg-accent transition-colors"
							>
								<CardContent className="pt-6">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-3 mb-2">
												<h3 className="text-lg font-semibold text-foreground">
													{workflow.name}
												</h3>
												<span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
													{workflow.workflowType}
												</span>
												{workflow.isActive ? (
													<span className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
														Active
													</span>
												) : (
													<span className="px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
														Inactive
													</span>
												)}
											</div>
											{workflow.description && (
												<p className="text-sm text-muted-foreground mb-3">
													{workflow.description}
												</p>
											)}
											<div className="flex items-center gap-4 text-xs text-muted-foreground">
												<span>
													Created:{" "}
													{new Date(workflow.createdAt).toLocaleDateString()}
												</span>
												<span>
													Updated:{" "}
													{new Date(workflow.updatedAt).toLocaleDateString()}
												</span>
											</div>
										</div>
										<div className="flex items-center gap-2 ml-4">
											<Link href={`/workflows/builder?edit=${workflow.id}`}>
												<Button variant="outline" size="sm">
													<Edit className="h-4 w-4" />
												</Button>
											</Link>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleExport(workflow.id, workflow.name)}
											>
												<Download className="h-4 w-4" />
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleDelete(workflow.id, workflow.name)}
												disabled={deletingId === workflow.id}
												className="text-destructive hover:text-destructive"
											>
												{deletingId === workflow.id ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Trash2 className="h-4 w-4" />
												)}
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
