/**
 * Data Flow Visualization
 * 
 * Visual guide showing how data moves between systems.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import GlassPanel from "@/components/ui/GlassPanel";
import { ArrowLeft, Users, MessageSquare, Phone, ArrowRight } from "lucide-react";

export default function DataFlowPage() {
	const [selectedFlow, setSelectedFlow] = useState<"contacts" | "messages" | "calls" | null>(null);

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
						Data Flow
					</h1>
					<p className="text-xl text-zinc-600 dark:text-zinc-400">
						See how information moves between our systems
					</p>
				</div>

				{/* Flow Selector */}
				<div className="grid md:grid-cols-3 gap-4 mb-8">
					<button
						onClick={() => setSelectedFlow("contacts")}
						className={`p-6 rounded-lg border-2 transition-colors text-left ${
							selectedFlow === "contacts"
								? "border-cyan-500 bg-cyan-500/10"
								: "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-cyan-500/50"
						}`}
					>
						<Users className="h-8 w-8 text-cyan-400 mb-3" />
						<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Contact Sync</h3>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							How contacts sync between GHL and Aloware
						</p>
					</button>

					<button
						onClick={() => setSelectedFlow("messages")}
						className={`p-6 rounded-lg border-2 transition-colors text-left ${
							selectedFlow === "messages"
								? "border-green-500 bg-green-500/10"
								: "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-green-500/50"
						}`}
					>
						<MessageSquare className="h-8 w-8 text-green-400 mb-3" />
						<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Message Sync</h3>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							How SMS messages sync across platforms
						</p>
					</button>

					<button
						onClick={() => setSelectedFlow("calls")}
						className={`p-6 rounded-lg border-2 transition-colors text-left ${
							selectedFlow === "calls"
								? "border-blue-500 bg-blue-500/10"
								: "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-500/50"
						}`}
					>
						<Phone className="h-8 w-8 text-blue-400 mb-3" />
						<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Call Sync</h3>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							How call data syncs from Aloware to GHL
						</p>
					</button>
				</div>

				{/* Contact Flow */}
				{selectedFlow === "contacts" && (
					<GlassPanel variant="default" className="mb-8 p-8">
						<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
							Contact Synchronization Flow
						</h2>
						<div className="space-y-6">
							{/* Step 1 */}
							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg">
									1
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Contact Updated in Aloware
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										When a contact's information changes in Aloware (name, phone, email, etc.), Aloware sends
										a webhook notification to our middleware.
									</p>
									<div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
										<div className="flex items-center gap-2 text-sm">
											<span className="font-mono text-cyan-400">Aloware</span>
											<ArrowRight className="h-4 w-4 text-zinc-400" />
											<span className="font-mono text-green-400">DF-Middleware</span>
										</div>
									</div>
								</div>
							</div>

							{/* Step 2 */}
							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-lg">
									2
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Event Stored & Queued
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										The middleware stores the event in the database and adds it to a processing queue. This
										ensures we don't lose any updates even if processing is temporarily unavailable.
									</p>
									<div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
										<div className="text-sm text-zinc-600 dark:text-zinc-400">
											<span className="font-semibold">Status:</span> Pending → Processing → Done
										</div>
									</div>
								</div>
							</div>

							{/* Step 3 */}
							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">
									3
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Find or Create Mapping
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										The system checks if we already have a mapping between this Aloware contact and a GHL
										contact. If not, it tries to find an existing GHL contact by phone or email, or creates a
										new one.
									</p>
									<div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
										<div className="text-sm text-zinc-600 dark:text-zinc-400">
											<span className="font-semibold">Mapping:</span> Aloware Contact ID ↔ GHL Contact ID
										</div>
									</div>
								</div>
							</div>

							{/* Step 4 */}
							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
									4
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Update GHL Contact
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										The middleware updates the corresponding contact in GHL with the new information from
										Aloware. This keeps both systems synchronized.
									</p>
									<div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
										<div className="flex items-center gap-2 text-sm">
											<span className="font-mono text-green-400">DF-Middleware</span>
											<ArrowRight className="h-4 w-4 text-zinc-400" />
											<span className="font-mono text-indigo-400">GoHighLevel</span>
										</div>
									</div>
								</div>
							</div>

							{/* Step 5 */}
							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-lg">
									5
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Log Sync Operation
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										The system logs the sync operation for audit purposes. This helps us track what was synced,
										when, and if there were any errors.
									</p>
									<div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
										<div className="text-sm text-zinc-600 dark:text-zinc-400">
											<span className="font-semibold">Result:</span> Success / Error (with details)
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg">
							<h4 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
								Bidirectional Sync
							</h4>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								The same process works in reverse: when a contact is updated in GHL, it automatically syncs
								back to Aloware. This keeps both systems always in sync.
							</p>
						</div>
					</GlassPanel>
				)}

				{/* Message Flow */}
				{selectedFlow === "messages" && (
					<GlassPanel variant="default" className="mb-8 p-8">
						<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
							Message Synchronization Flow
						</h2>
						<div className="space-y-6">
							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-lg">
									1
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Message Received via Texting System
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										When someone sends or receives an SMS message through our texting system, a webhook is
										sent to the middleware.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">
									2
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Find Contact Mapping
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										The system looks up which GHL contact this message belongs to based on the phone number.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
									3
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Add to GHL Conversation
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										The message is added to the contact's conversation thread in GHL, making it visible to
										the team.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-lg">
									4
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Store Message Mapping
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										The system stores a mapping between the texting system message ID and the GHL message ID
										for future reference.
									</p>
								</div>
							</div>
						</div>
					</GlassPanel>
				)}

				{/* Call Flow */}
				{selectedFlow === "calls" && (
					<GlassPanel variant="default" className="mb-8 p-8">
						<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
							Call Synchronization Flow
						</h2>
						<div className="space-y-6">
							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">
									1
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Call Completed in Aloware
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										When a call ends in Aloware, it sends a webhook with call details (duration, outcome,
										notes, etc.).
									</p>
								</div>
							</div>

							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-lg">
									2
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Find GHL Contact
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										The system finds the corresponding GHL contact using the phone number from the call.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
									3
								</div>
								<div className="flex-1">
									<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
										Add Call Activity
									</h3>
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
										The call is added as an activity/note on the GHL contact, including duration, outcome, and
										any notes from Aloware.
									</p>
								</div>
							</div>
						</div>
					</GlassPanel>
				)}

				{/* Default State */}
				{!selectedFlow && (
					<GlassPanel variant="default" className="p-12 text-center">
						<p className="text-lg text-zinc-600 dark:text-zinc-400">
							Select a data flow type above to see how information moves between systems
						</p>
					</GlassPanel>
				)}
			</div>
		</div>
	);
}
