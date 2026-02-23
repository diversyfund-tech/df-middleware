/**
 * Workflows Overview Page
 * 
 * Explains the workflow system for non-technical users.
 */

"use client";

import Link from "next/link";
import GlassPanel from "@/components/ui/GlassPanel";
import { ArrowLeft, Workflow, CheckCircle2, Clock, Zap } from "lucide-react";

export default function WorkflowsPage() {
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
						Workflow System
					</h1>
					<p className="text-xl text-zinc-600 dark:text-zinc-400">
						How automated workflows help our voice agents
					</p>
				</div>

				{/* What Are Workflows */}
				<GlassPanel variant="default" className="mb-8 p-8">
					<div className="flex items-start gap-4 mb-6">
						<Workflow className="h-8 w-8 text-purple-400 flex-shrink-0" />
						<div>
							<h2 className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
								What Are Workflows?
							</h2>
							<p className="text-zinc-600 dark:text-zinc-400 mb-4">
								Workflows are step-by-step instructions that help our AI voice agents complete tasks automatically.
								Think of them as a recipe that the agent follows to accomplish a goal, like booking an
								appointment or collecting customer information.
							</p>
							<p className="text-zinc-600 dark:text-zinc-400">
								When a customer calls and the agent needs to perform an action, the workflow guides the agent
								through each step, ensuring nothing is missed and everything is done correctly.
							</p>
						</div>
					</div>
				</GlassPanel>

				{/* How Workflows Work */}
				<GlassPanel variant="default" className="mb-8 p-8">
					<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
						How Workflows Work
					</h2>
					<div className="space-y-6">
						<div className="flex items-start gap-4">
							<div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
								1
							</div>
							<div className="flex-1">
								<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
									Customer Calls
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									A customer calls and talks to our AI voice agent. During the conversation, the agent identifies
									what the customer needs.
								</p>
							</div>
						</div>

						<div className="flex items-start gap-4">
							<div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">
								2
							</div>
							<div className="flex-1">
								<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
									Workflow Triggered
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Based on what the customer needs, the system selects the appropriate workflow. For example, if
									they want to book an appointment, the "appointment booking" workflow starts.
								</p>
							</div>
						</div>

						<div className="flex items-start gap-4">
							<div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-lg">
								3
							</div>
							<div className="flex-1">
								<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
									Steps Executed
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									The workflow guides the agent through each step: collecting information, making decisions, and
									performing actions like creating records or sending confirmations.
								</p>
							</div>
						</div>

						<div className="flex items-start gap-4">
							<div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-lg">
								4
							</div>
							<div className="flex-1">
								<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
									Task Completed
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Once all steps are complete, the workflow finishes. The customer's request has been handled,
									and all systems are updated with the new information.
								</p>
							</div>
						</div>
					</div>
				</GlassPanel>

				{/* Workflow Types */}
				<GlassPanel variant="default" className="mb-8 p-8">
					<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
						Types of Workflows
					</h2>
					<div className="grid md:grid-cols-3 gap-6">
						<div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
							<div className="flex items-center gap-3 mb-3">
								<CheckCircle2 className="h-6 w-6 text-green-400" />
								<h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Sales</h3>
							</div>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Helps agents qualify leads, collect information, and move prospects through the sales process.
							</p>
						</div>

						<div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
							<div className="flex items-center gap-3 mb-3">
								<Clock className="h-6 w-6 text-blue-400" />
								<h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Appointment</h3>
							</div>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Guides agents through booking appointments, checking availability, and sending confirmations.
							</p>
						</div>

						<div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
							<div className="flex items-center gap-3 mb-3">
								<Zap className="h-6 w-6 text-purple-400" />
								<h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Support</h3>
							</div>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Helps agents categorize issues, route to the right team, and create support tickets.
							</p>
						</div>
					</div>
				</GlassPanel>

				{/* Benefits */}
				<GlassPanel variant="default" className="p-8">
					<h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
						Benefits of Workflows
					</h2>
					<div className="grid md:grid-cols-2 gap-6">
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Consistency</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Every customer interaction follows the same process, ensuring nothing is missed.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Efficiency</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Agents can complete tasks faster with clear step-by-step guidance.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Accuracy</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Workflows ensure all required information is collected and validated.
							</p>
						</div>
						<div>
							<h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Automation</h3>
							<p className="text-sm text-zinc-600 dark:text-zinc-400">
								Many steps happen automatically, reducing manual work for agents.
							</p>
						</div>
					</div>
				</GlassPanel>
			</div>
		</div>
	);
}
