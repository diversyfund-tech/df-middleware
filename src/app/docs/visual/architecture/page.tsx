/**
 * System Architecture Visualization
 * 
 * Interactive diagram showing how DF-Middleware components connect.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GlassPanel from "@/components/ui/GlassPanel";
import { ArrowLeft, Server, Database, Cloud, Zap } from "lucide-react";

export default function ArchitecturePage() {
	const [systemStatus, setSystemStatus] = useState<Record<string, "ok" | "warning" | "error">>({});

	useEffect(() => {
		// Fetch system status
		fetch("/api/docs/system-status")
			.then((res) => res.json())
			.then((data) => {
				if (data.components) {
					const status: Record<string, "ok" | "warning" | "error"> = {};
					Object.entries(data.components).forEach(([key, value]: [string, any]) => {
						status[key] = value.status === "ok" ? "ok" : value.status === "warning" ? "warning" : "error";
					});
					setSystemStatus(status);
				}
			})
			.catch(() => {
				// Ignore errors for now
			});
	}, []);

	const getStatusColor = (status: "ok" | "warning" | "error" | undefined) => {
		if (status === "ok") return "bg-green-500";
		if (status === "warning") return "bg-yellow-500";
		if (status === "error") return "bg-red-500";
		return "bg-zinc-500";
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
					<h1 className="text-4xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
						System Architecture
					</h1>
					<p className="text-xl text-zinc-600 dark:text-zinc-400">
						How DF-Middleware connects all our systems together
					</p>
				</div>

				{/* Architecture Diagram */}
				<GlassPanel variant="default" className="mb-8 p-8">
					<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
						Component Overview
					</h2>

					{/* DF-Middleware Core */}
					<div className="mb-12">
						<h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
							DF-Middleware Core
						</h3>
						<div className="grid md:grid-cols-3 gap-4">
							<div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg border-2 border-blue-500/30">
								<div className="flex items-center gap-3 mb-3">
									<Server className="h-6 w-6 text-blue-400" />
									<h4 className="font-semibold text-zinc-900 dark:text-zinc-50">Express Server</h4>
									<div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.express)} ml-auto`} />
								</div>
								<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
									Port: 3001
								</p>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									API Gateway for Verity API requests
								</p>
							</div>

							<div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg border-2 border-green-500/30">
								<div className="flex items-center gap-3 mb-3">
									<Zap className="h-6 w-6 text-green-400" />
									<h4 className="font-semibold text-zinc-900 dark:text-zinc-50">Next.js API</h4>
									<div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.nextjs)} ml-auto`} />
								</div>
								<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
									Port: 3002
								</p>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Webhook handlers and sync endpoints
								</p>
							</div>

							<div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg border-2 border-purple-500/30">
								<div className="flex items-center gap-3 mb-3">
									<Database className="h-6 w-6 text-purple-400" />
									<h4 className="font-semibold text-zinc-900 dark:text-zinc-50">Database</h4>
									<div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.database)} ml-auto`} />
								</div>
								<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
									PostgreSQL
								</p>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Stores events, mappings, and sync logs
								</p>
							</div>
						</div>
					</div>

					{/* External Integrations */}
					<div>
						<h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
							Connected Systems
						</h3>
						<div className="grid md:grid-cols-3 gap-4">
							<div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg border-2 border-cyan-500/30">
								<div className="flex items-center gap-3 mb-3">
									<Cloud className="h-6 w-6 text-cyan-400" />
									<h4 className="font-semibold text-zinc-900 dark:text-zinc-50">GoHighLevel</h4>
									<div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.ghl)} ml-auto`} />
								</div>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									CRM platform for contacts, messages, and appointments
								</p>
							</div>

							<div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg border-2 border-orange-500/30">
								<div className="flex items-center gap-3 mb-3">
									<Cloud className="h-6 w-6 text-orange-400" />
									<h4 className="font-semibold text-zinc-900 dark:text-zinc-50">Aloware</h4>
									<div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.aloware)} ml-auto`} />
								</div>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Call center platform for calls and contact management
								</p>
							</div>

							<div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg border-2 border-indigo-500/30">
								<div className="flex items-center gap-3 mb-3">
									<Cloud className="h-6 w-6 text-indigo-400" />
									<h4 className="font-semibold text-zinc-900 dark:text-zinc-50">Verity</h4>
									<div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.verity)} ml-auto`} />
								</div>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Capital management platform and API gateway
								</p>
							</div>
						</div>
					</div>
				</GlassPanel>

				{/* How It Works */}
				<GlassPanel variant="default" className="mb-8 p-8">
					<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
						How It Works
					</h2>
					<div className="space-y-6">
						<div className="flex gap-4">
							<div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
								1
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
									Webhooks Arrive
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									When something changes in GHL or Aloware, they send a webhook notification to our middleware.
								</p>
							</div>
						</div>

						<div className="flex gap-4">
							<div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">
								2
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
									Events Stored
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									The middleware stores the event in the database and queues it for processing.
								</p>
							</div>
						</div>

						<div className="flex gap-4">
							<div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
								3
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
									Sync Processing
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									A background worker processes the event and updates the other system accordingly.
								</p>
							</div>
						</div>

						<div className="flex gap-4">
							<div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
								4
							</div>
							<div>
								<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
									Data Synchronized
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Both systems now have the updated information, keeping everything in sync.
								</p>
							</div>
						</div>
					</div>
				</GlassPanel>

				{/* Key Features */}
				<GlassPanel variant="default" className="p-8">
					<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
						Key Features
					</h2>
					<div className="grid md:grid-cols-2 gap-6">
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Automatic Sync</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Changes in one system automatically update in others without manual intervention.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Duplicate Prevention</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								The system prevents processing the same event twice, ensuring data integrity.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Error Handling</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Failed syncs are retried automatically, and errors are logged for review.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Real-time Processing</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Events are processed as soon as they arrive, keeping data fresh and up-to-date.
							</p>
						</div>
					</div>
				</GlassPanel>
			</div>
		</div>
	);
}
