/**
 * Integrations Status Page
 * 
 * Shows status and information about each connected system.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GlassPanel from "@/components/ui/GlassPanel";
import { ArrowLeft, CheckCircle2, AlertCircle, XCircle, RefreshCw } from "lucide-react";

interface IntegrationStatus {
	name: string;
	status: "ok" | "warning" | "error";
	message?: string;
	description: string;
	icon: string;
	color: string;
}

export default function IntegrationsPage() {
	const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadStatuses();
		const interval = setInterval(loadStatuses, 30000); // Refresh every 30 seconds
		return () => clearInterval(interval);
	}, []);

	const loadStatuses = async () => {
		try {
			const res = await fetch("/api/docs/integration-status");
			const data = await res.json();
			setStatuses(data.integrations || {});
		} catch (error) {
			console.error("Failed to load integration status:", error);
		} finally {
			setLoading(false);
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "ok":
				return <CheckCircle2 className="h-5 w-5 text-green-400" />;
			case "warning":
				return <AlertCircle className="h-5 w-5 text-yellow-400" />;
			case "error":
				return <XCircle className="h-5 w-5 text-red-400" />;
			default:
				return <AlertCircle className="h-5 w-5 text-zinc-400" />;
		}
	};

	const integrations: IntegrationStatus[] = [
		{
			name: "GoHighLevel",
			status: statuses.ghl?.status || "warning",
			message: statuses.ghl?.message,
			description:
				"Our CRM platform where contacts, messages, and appointments are stored. All customer interactions are tracked here.",
			icon: "📊",
			color: "cyan",
		},
		{
			name: "Aloware",
			status: statuses.aloware?.status || "warning",
			message: statuses.aloware?.message,
			description:
				"Call center platform used for making and receiving phone calls. Call data and contact information sync to GHL.",
			icon: "📞",
			color: "orange",
		},
		{
			name: "Verity",
			status: statuses.verity?.status || "warning",
			message: statuses.verity?.message,
			description:
				"Capital management platform and API gateway. Provides unified access to business data and operations.",
			icon: "💼",
			color: "indigo",
		},
	];

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
								Integrations
							</h1>
							<p className="text-xl text-zinc-600 dark:text-zinc-400">
								Status and information about connected systems
							</p>
						</div>
						<button
							onClick={loadStatuses}
							disabled={loading}
							className="p-3 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
						>
							<RefreshCw className={`h-5 w-5 text-zinc-600 dark:text-zinc-400 ${loading ? "animate-spin" : ""}`} />
						</button>
					</div>
				</div>

				{/* Integration Cards */}
				<div className="grid md:grid-cols-3 gap-6 mb-8">
					{integrations.map((integration) => (
						<GlassPanel
							key={integration.name}
							variant="default"
							className={`p-6 border-2 ${
								integration.status === "ok"
									? "border-green-500/30"
									: integration.status === "warning"
										? "border-yellow-500/30"
										: "border-red-500/30"
							}`}
						>
							<div className="flex items-start justify-between mb-4">
								<div className="flex items-center gap-3">
									<span className="text-3xl">{integration.icon}</span>
									<div>
										<h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
											{integration.name}
										</h3>
										<div className="flex items-center gap-2 mt-1">
											{getStatusIcon(integration.status)}
											<span className="text-sm text-zinc-600 dark:text-zinc-400 capitalize">
												{integration.status}
											</span>
										</div>
									</div>
								</div>
							</div>
							<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
								{integration.description}
							</p>
							{integration.message && (
								<div
									className={`text-xs p-2 rounded ${
										integration.status === "ok"
											? "bg-green-500/20 text-green-400"
											: integration.status === "warning"
												? "bg-yellow-500/20 text-yellow-400"
												: "bg-red-500/20 text-red-400"
									}`}
								>
									{integration.message}
								</div>
							)}
						</GlassPanel>
					))}
				</div>

				{/* How Integrations Work */}
				<GlassPanel variant="default" className="p-8">
					<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
						How Integrations Work
					</h2>
					<div className="space-y-4">
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
								Webhook Notifications
							</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Each system sends webhook notifications when data changes. These are like "ping" messages that
								tell our middleware "something changed, please sync it."
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
								Automatic Processing
							</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								The middleware receives these notifications and automatically processes them in the background.
								This happens without any manual intervention.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
								Bidirectional Sync
							</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Changes flow both ways. If a contact is updated in GHL, it syncs to Aloware. If updated in
								Aloware, it syncs to GHL. This keeps everything consistent.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
								Error Handling
							</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								If a sync fails, the system automatically retries. If it continues to fail, it's logged for
								review. This ensures data integrity and helps identify issues quickly.
							</p>
						</div>
					</div>
				</GlassPanel>
			</div>
		</div>
	);
}
