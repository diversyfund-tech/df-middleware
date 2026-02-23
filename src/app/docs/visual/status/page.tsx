/**
 * System Status Dashboard
 * 
 * Real-time system health and integration status.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GlassPanel from "@/components/ui/GlassPanel";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface SystemStatus {
	status: string;
	timestamp: string;
	components: Record<string, { status: string; message?: string }>;
}

export default function StatusPage() {
	const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadStatus();
		const interval = setInterval(loadStatus, 30000); // Refresh every 30 seconds
		return () => clearInterval(interval);
	}, []);

	const loadStatus = async () => {
		try {
			const res = await fetch("/api/docs/system-status");
			const data = await res.json();
			setSystemStatus(data);
		} catch (error) {
			console.error("Failed to load system status:", error);
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

	const getStatusColor = (status: string) => {
		switch (status) {
			case "ok":
				return "text-green-400";
			case "warning":
				return "text-yellow-400";
			case "error":
				return "text-red-400";
			default:
				return "text-zinc-400";
		}
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
								System Status
							</h1>
							<p className="text-xl text-zinc-600 dark:text-zinc-400">
								Real-time health monitoring
							</p>
						</div>
						<button
							onClick={loadStatus}
							disabled={loading}
							className="p-3 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
						>
							<RefreshCw className={`h-5 w-5 text-zinc-600 dark:text-zinc-400 ${loading ? "animate-spin" : ""}`} />
						</button>
					</div>
				</div>

				{/* Overall Status */}
				{systemStatus && (
					<GlassPanel
						variant="default"
						className={`mb-8 p-8 border-2 ${
							systemStatus.status === "ok"
								? "border-green-500/30"
								: systemStatus.status === "warning"
									? "border-yellow-500/30"
									: "border-red-500/30"
						}`}
					>
						<div className="flex items-center gap-4 mb-4">
							{getStatusIcon(systemStatus.status)}
							<div>
								<h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
									Overall System Status
								</h2>
								<p className={`text-lg font-medium capitalize ${getStatusColor(systemStatus.status)}`}>
									{systemStatus.status}
								</p>
							</div>
						</div>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Last updated: {new Date(systemStatus.timestamp).toLocaleString()}
						</p>
					</GlassPanel>
				)}

				{/* Component Status */}
				{systemStatus && (
					<GlassPanel variant="default" className="p-8">
						<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
							Component Status
						</h2>
						<div className="grid md:grid-cols-2 gap-4">
							{Object.entries(systemStatus.components).map(([name, component]) => (
								<div
									key={name}
									className={`p-4 rounded-lg border-2 ${
										component.status === "ok"
											? "border-green-500/30 bg-green-500/5"
											: component.status === "warning"
												? "border-yellow-500/30 bg-yellow-500/5"
												: "border-red-500/30 bg-red-500/5"
									}`}
								>
									<div className="flex items-center justify-between mb-2">
										<h3 className="font-semibold capitalize text-zinc-900 dark:text-zinc-50">
											{name.replace(/([A-Z])/g, " $1").trim()}
										</h3>
										{getStatusIcon(component.status)}
									</div>
									<p className={`text-sm capitalize ${getStatusColor(component.status)}`}>
										{component.status}
									</p>
									{component.message && (
										<p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
											{component.message}
										</p>
									)}
								</div>
							))}
						</div>
					</GlassPanel>
				)}

				{loading && !systemStatus && (
					<GlassPanel variant="default" className="p-12 text-center">
						<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-cyan-400" />
						<p className="text-sm text-zinc-600 dark:text-zinc-400">Loading system status...</p>
					</GlassPanel>
				)}
			</div>
		</div>
	);
}
