/**
 * Sync History Timeline
 * 
 * Visual timeline of sync operations for non-technical users.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GlassPanel from "@/components/ui/GlassPanel";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";

interface SyncOperation {
	id: string;
	direction: string;
	entityType: string;
	status: string;
	finishedAt: string;
	errorMessage?: string;
}

export default function SyncHistoryPage() {
	const [syncs, setSyncs] = useState<SyncOperation[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadSyncHistory();
		const interval = setInterval(loadSyncHistory, 60000); // Refresh every minute
		return () => clearInterval(interval);
	}, []);

	const loadSyncHistory = async () => {
		try {
			const res = await fetch("/api/docs/sync-metrics?limit=30");
			const data = await res.json();
			setSyncs(data.syncs || []);
		} catch (error) {
			console.error("Failed to load sync history:", error);
		} finally {
			setLoading(false);
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "success":
				return <CheckCircle2 className="h-5 w-5 text-green-400" />;
			case "error":
				return <XCircle className="h-5 w-5 text-red-400" />;
			default:
				return <Clock className="h-5 w-5 text-yellow-400" />;
		}
	};

	const formatDirection = (direction: string) => {
		return direction
			.replace(/_/g, " ")
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" → ");
	};

	const formatEntityType = (entityType: string) => {
		return entityType.charAt(0).toUpperCase() + entityType.slice(1);
	};

	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-12 max-w-7xl">
				{/* Header */}
				<div className="mb-8">
					<Link
						href="/docs/visual"
						className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4"
					>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Visual Guide
					</Link>
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-4xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
								Sync History
							</h1>
							<p className="text-xl text-zinc-600 dark:text-zinc-400">
								Timeline of synchronization operations
							</p>
						</div>
						<button
							onClick={loadSyncHistory}
							disabled={loading}
							className="p-3 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
						>
							<RefreshCw className={`h-5 w-5 text-zinc-600 dark:text-zinc-400 ${loading ? "animate-spin" : ""}`} />
						</button>
					</div>
				</div>

				{/* Timeline */}
				{loading && syncs.length === 0 ? (
					<GlassPanel variant="default" className="p-12 text-center">
						<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-cyan-400" />
						<p className="text-sm text-zinc-600 dark:text-zinc-400">Loading sync history...</p>
					</GlassPanel>
				) : syncs.length === 0 ? (
					<GlassPanel variant="default" className="p-12 text-center">
						<p className="text-lg text-zinc-600 dark:text-zinc-400">No sync operations found</p>
					</GlassPanel>
				) : (
					<div className="relative">
						{/* Timeline Line */}
						<div className="absolute left-8 top-0 bottom-0 w-0.5 bg-zinc-300 dark:bg-zinc-700" />

						{/* Sync Operations */}
						<div className="space-y-6">
							{syncs.map((sync, index) => (
								<div key={sync.id} className="relative flex items-start gap-6">
									{/* Timeline Dot */}
									<div
										className={`relative z-10 flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center ${
											sync.status === "success"
												? "bg-green-500/20 border-2 border-green-500"
												: sync.status === "error"
													? "bg-red-500/20 border-2 border-red-500"
													: "bg-yellow-500/20 border-2 border-yellow-500"
										}`}
									>
										{getStatusIcon(sync.status)}
									</div>

									{/* Content */}
									<GlassPanel
										variant="default"
										className={`flex-1 p-6 border-l-4 ${
											sync.status === "success"
												? "border-l-green-500"
												: sync.status === "error"
													? "border-l-red-500"
													: "border-l-yellow-500"
										}`}
									>
										<div className="flex items-start justify-between mb-3">
											<div className="flex-1">
												<div className="flex items-center gap-3 mb-2">
													<h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
														{formatEntityType(sync.entityType)} Sync
													</h3>
													<span className="px-2 py-1 rounded text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
														{formatDirection(sync.direction)}
													</span>
												</div>
												<p className="text-sm text-zinc-600 dark:text-zinc-400">
													{new Date(sync.finishedAt).toLocaleString()}
												</p>
											</div>
											<span
												className={`px-3 py-1 rounded text-xs font-medium capitalize ${
													sync.status === "success"
														? "bg-green-500/20 text-green-400"
														: sync.status === "error"
															? "bg-red-500/20 text-red-400"
															: "bg-yellow-500/20 text-yellow-400"
												}`}
											>
												{sync.status}
											</span>
										</div>
										{sync.errorMessage && (
											<div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
												{sync.errorMessage}
											</div>
										)}
									</GlassPanel>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Info Panel */}
				<GlassPanel variant="default" className="mt-8 p-6">
					<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">About Sync Operations</h3>
					<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
						Sync operations represent the actual work of keeping data synchronized between systems. Each operation
						shows what was synced, which direction it went, and whether it succeeded or failed.
					</p>
					<div className="grid md:grid-cols-2 gap-4 mt-4">
						<div>
							<h4 className="font-medium mb-2 text-zinc-900 dark:text-zinc-50">Sync Directions</h4>
							<ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
								<li>
									<ArrowRight className="h-4 w-4 inline mr-2" />
									Aloware → GHL: Updates flow from Aloware to GHL
								</li>
								<li>
									<ArrowRight className="h-4 w-4 inline mr-2" />
									GHL → Aloware: Updates flow from GHL to Aloware
								</li>
							</ul>
						</div>
						<div>
							<h4 className="font-medium mb-2 text-zinc-900 dark:text-zinc-50">Entity Types</h4>
							<ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
								<li>Contact: Customer contact information</li>
								<li>Call: Phone call records and notes</li>
								<li>Message: SMS and text messages</li>
							</ul>
						</div>
					</div>
				</GlassPanel>
			</div>
		</div>
	);
}
