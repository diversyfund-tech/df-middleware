/**
 * Event Explorer
 * 
 * Simplified view of recent webhook events for non-technical users.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GlassPanel from "@/components/ui/GlassPanel";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Event {
	id: string;
	source: string;
	eventType: string;
	entityType: string;
	status: string;
	createdAt: string;
}

export default function EventsPage() {
	const [events, setEvents] = useState<Event[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadEvents();
		const interval = setInterval(loadEvents, 60000); // Refresh every minute
		return () => clearInterval(interval);
	}, []);

	const loadEvents = async () => {
		try {
			const res = await fetch("/api/docs/recent-events?limit=20");
			const data = await res.json();
			setEvents(data.events || []);
		} catch (error) {
			console.error("Failed to load events:", error);
		} finally {
			setLoading(false);
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "done":
				return <CheckCircle2 className="h-4 w-4 text-green-400" />;
			case "error":
				return <XCircle className="h-4 w-4 text-red-400" />;
			case "processing":
				return <Clock className="h-4 w-4 text-yellow-400 animate-spin" />;
			default:
				return <Clock className="h-4 w-4 text-zinc-400" />;
		}
	};

	const formatEventType = (eventType: string) => {
		return eventType
			.replace(/([A-Z])/g, " $1")
			.replace(/\./g, " ")
			.trim()
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");
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
								Event Explorer
							</h1>
							<p className="text-xl text-zinc-600 dark:text-zinc-400">
								Recent webhook events and sync operations
							</p>
						</div>
						<button
							onClick={loadEvents}
							disabled={loading}
							className="p-3 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
						>
							<RefreshCw className={`h-5 w-5 text-zinc-600 dark:text-zinc-400 ${loading ? "animate-spin" : ""}`} />
						</button>
					</div>
				</div>

				{/* Events List */}
				{loading && events.length === 0 ? (
					<GlassPanel variant="default" className="p-12 text-center">
						<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-cyan-400" />
						<p className="text-sm text-zinc-600 dark:text-zinc-400">Loading events...</p>
					</GlassPanel>
				) : events.length === 0 ? (
					<GlassPanel variant="default" className="p-12 text-center">
						<p className="text-lg text-zinc-600 dark:text-zinc-400">No recent events found</p>
					</GlassPanel>
				) : (
					<div className="space-y-4">
						{events.map((event) => (
							<GlassPanel
								key={event.id}
								variant="default"
								className={`p-6 border-l-4 ${
									event.status === "done"
										? "border-l-green-500"
										: event.status === "error"
											? "border-l-red-500"
											: event.status === "processing"
												? "border-l-yellow-500"
												: "border-l-zinc-500"
								}`}
							>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-3 mb-2">
											{getStatusIcon(event.status)}
											<h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
												{formatEventType(event.eventType)}
											</h3>
											<span className="px-2 py-1 rounded text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 capitalize">
												{event.source}
											</span>
											<span className="px-2 py-1 rounded text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 capitalize">
												{event.entityType}
											</span>
										</div>
										<p className="text-sm text-zinc-600 dark:text-zinc-400">
											{new Date(event.createdAt).toLocaleString()}
										</p>
									</div>
									<div className="ml-4">
										<span
											className={`px-3 py-1 rounded text-xs font-medium capitalize ${
												event.status === "done"
													? "bg-green-500/20 text-green-400"
													: event.status === "error"
														? "bg-red-500/20 text-red-400"
														: event.status === "processing"
															? "bg-yellow-500/20 text-yellow-400"
															: "bg-zinc-500/20 text-zinc-400"
											}`}
										>
											{event.status}
										</span>
									</div>
								</div>
							</GlassPanel>
						))}
					</div>
				)}

				{/* Info Panel */}
				<GlassPanel variant="default" className="mt-8 p-6">
					<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">About Events</h3>
					<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
						Events represent changes that happen in our connected systems. When a contact is updated, a message
						is sent, or a call is completed, an event is created and processed to keep everything synchronized.
					</p>
					<div className="grid md:grid-cols-3 gap-4 mt-4">
						<div>
							<div className="flex items-center gap-2 mb-1">
								<CheckCircle2 className="h-4 w-4 text-green-400" />
								<span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Done</span>
							</div>
							<p className="text-xs text-zinc-600 dark:text-zinc-400">
								Event processed successfully
							</p>
						</div>
						<div>
							<div className="flex items-center gap-2 mb-1">
								<Clock className="h-4 w-4 text-yellow-400" />
								<span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Processing</span>
							</div>
							<p className="text-xs text-zinc-600 dark:text-zinc-400">
								Event is currently being processed
							</p>
						</div>
						<div>
							<div className="flex items-center gap-2 mb-1">
								<XCircle className="h-4 w-4 text-red-400" />
								<span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Error</span>
							</div>
							<p className="text-xs text-zinc-600 dark:text-zinc-400">
								Event processing failed (will retry)
							</p>
						</div>
					</div>
				</GlassPanel>
			</div>
		</div>
	);
}
