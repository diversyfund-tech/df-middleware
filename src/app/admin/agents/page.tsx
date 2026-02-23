"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import GlassPanel from "@/components/ui/GlassPanel";

type Agent = {
	id: string;
	agentKey: string;
	displayName: string;
	ghlOwnerId: string | null;
	ghlOwnerEmail: string | null;
	ghlAssignedAgentFieldValue: string | null;
	requiredTag: string | null;
	alowareUserId: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
};

export default function AgentsPage() {
	const [agents, setAgents] = useState<Agent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState(false);

	const fetchAgents = async () => {
		try {
			setError(null);
			const adminSecret = prompt("Enter admin secret:");
			if (!adminSecret) {
				setError("Admin secret required");
				return;
			}

			const response = await fetch("/api/admin/agents/seed", {
				headers: {
					"X-DF-ADMIN-SECRET": adminSecret,
				},
			});

			if (!response.ok) {
				if (response.status === 401) {
					setError("Unauthorized - Invalid admin secret");
				} else {
					setError(`Failed to fetch agents: ${response.statusText}`);
				}
				return;
			}

			const data = await response.json();
			setAgents(data.agents || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch agents");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		fetchAgents();
	}, []);

	const handleRefresh = () => {
		setRefreshing(true);
		fetchAgents();
	};

	const handleSeed = async () => {
		try {
			setError(null);
			const adminSecret = prompt("Enter admin secret:");
			if (!adminSecret) {
				setError("Admin secret required");
				return;
			}

			const response = await fetch("/api/admin/agents/seed", {
				method: "POST",
				headers: {
					"X-DF-ADMIN-SECRET": adminSecret,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				if (response.status === 401) {
					setError("Unauthorized - Invalid admin secret");
				} else {
					const errorData = await response.json();
					setError(`Failed to seed agents: ${errorData.error || response.statusText}`);
				}
				return;
			}

			const data = await response.json();
			alert(`Successfully seeded ${data.seeded} new agent(s)`);
			fetchAgents();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to seed agents");
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<GlassPanel className="p-8">
					<div className="flex items-center gap-3">
						<Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
						<span className="text-lg">Loading agents...</span>
					</div>
				</GlassPanel>
			</div>
		);
	}

	return (
		<div className="min-h-screen">
			<main className="container mx-auto px-4 py-8 max-w-6xl">
				{/* Header */}
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Link
							href="/"
							className="p-2 hover:bg-white/10 rounded-lg transition-colors"
						>
							<ArrowLeft className="h-5 w-5" />
						</Link>
						<div>
							<h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
								Agent Directory
							</h1>
							<p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
								Manage AI calling agents and their assignments
							</p>
						</div>
					</div>
					<div className="flex gap-2">
						<Button
							onClick={handleRefresh}
							disabled={refreshing}
							variant="outline"
							size="sm"
						>
							{refreshing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<RefreshCw className="h-4 w-4" />
							)}
							Refresh
						</Button>
						<Button onClick={handleSeed} variant="default" size="sm">
							Seed Agents
						</Button>
					</div>
				</div>

				{/* Error Message */}
				{error && (
					<GlassPanel className="mb-6 p-4 border-red-500/30 bg-red-500/10">
						<p className="text-sm text-red-600 dark:text-red-400">{error}</p>
					</GlassPanel>
				)}

				{/* Agents List */}
				{agents.length === 0 ? (
					<GlassPanel className="p-8 text-center">
						<p className="text-zinc-600 dark:text-zinc-400">
							No agents found. Click "Seed Agents" to create default agents.
						</p>
					</GlassPanel>
				) : (
					<div className="grid gap-4">
						{agents.map((agent) => (
							<GlassPanel key={agent.id} className="p-6">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-3 mb-3">
											<h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
												{agent.displayName}
											</h3>
											<span className="px-2 py-1 text-xs font-mono bg-zinc-200 dark:bg-zinc-700 rounded">
												{agent.agentKey}
											</span>
											{agent.isActive ? (
												<span className="px-2 py-1 text-xs bg-green-500/20 text-green-600 dark:text-green-400 rounded">
													Active
												</span>
											) : (
												<span className="px-2 py-1 text-xs bg-red-500/20 text-red-600 dark:text-red-400 rounded">
													Inactive
												</span>
											)}
										</div>

										<div className="grid md:grid-cols-2 gap-4 text-sm">
											<div>
												<h4 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
													GHL Integration
												</h4>
												<div className="space-y-1 text-zinc-600 dark:text-zinc-400">
													{agent.ghlOwnerId && (
														<div>
															<span className="font-medium">Owner ID:</span>{" "}
															<span className="font-mono text-xs">{agent.ghlOwnerId}</span>
														</div>
													)}
													{agent.ghlOwnerEmail && (
														<div>
															<span className="font-medium">Owner Email:</span>{" "}
															{agent.ghlOwnerEmail}
														</div>
													)}
													{agent.ghlAssignedAgentFieldValue && (
														<div>
															<span className="font-medium">Assigned Field Value:</span>{" "}
															{agent.ghlAssignedAgentFieldValue}
														</div>
													)}
													{agent.requiredTag && (
														<div>
															<span className="font-medium">Required Tag:</span>{" "}
															<span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded text-xs">
																{agent.requiredTag}
															</span>
														</div>
													)}
												</div>
											</div>

											<div>
												<h4 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
													Aloware Integration
												</h4>
												<div className="space-y-1 text-zinc-600 dark:text-zinc-400">
													{agent.alowareUserId ? (
														<div>
															<span className="font-medium">User ID:</span>{" "}
															<span className="font-mono text-xs">{agent.alowareUserId}</span>
														</div>
													) : (
														<div className="text-zinc-500 dark:text-zinc-500">
															No Aloware user assigned
														</div>
													)}
												</div>
											</div>
										</div>

										<div className="mt-4 pt-4 border-t border-white/10 text-xs text-zinc-500 dark:text-zinc-500">
											Created: {new Date(agent.createdAt).toLocaleString()} • Updated:{" "}
											{new Date(agent.updatedAt).toLocaleString()}
										</div>
									</div>
								</div>
							</GlassPanel>
						))}
					</div>
				)}

				{/* Footer */}
				<div className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
					<p>
						Total agents: <span className="font-semibold">{agents.length}</span>
					</p>
				</div>
			</main>
		</div>
	);
}
