/**
 * Visual Documentation Hub
 * 
 * Main entry point for visual documentation of the DF-Middleware system.
 * Designed for non-technical staff to understand system architecture and data flows.
 */

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Network,
	GitBranch,
	Plug,
	Workflow,
	Activity,
	BookOpen,
	ArrowRight,
} from "lucide-react";

export default function VisualDocsPage() {
	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-12 max-w-7xl">
				{/* Header */}
				<div className="mb-12 text-center">
					<h1 className="text-4xl font-bold mb-4 text-foreground">
						DF-Middleware Visual Guide
					</h1>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Understand how our middleware connects systems together and keeps data synchronized
					</p>
				</div>

				{/* Quick Overview */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>What is DF-Middleware?</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground mb-4">
							DF-Middleware is the central hub that connects our business systems together. It ensures that when
							information changes in one system, it automatically updates in the others. Think of it as a translator
							and synchronizer that keeps everything in sync.
						</p>
						<div className="grid md:grid-cols-3 gap-4 mt-6">
							<Card>
								<CardContent className="pt-6 text-center">
									<div className="text-3xl font-bold text-primary mb-2">3</div>
									<div className="text-sm text-muted-foreground">Connected Systems</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-6 text-center">
									<div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">24/7</div>
									<div className="text-sm text-muted-foreground">Automatic Sync</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-6 text-center">
									<div className="text-3xl font-bold text-primary mb-2">Real-time</div>
									<div className="text-sm text-muted-foreground">Updates</div>
								</CardContent>
							</Card>
						</div>
					</CardContent>
				</Card>

				{/* Navigation Cards */}
				<div className="grid md:grid-cols-2 gap-6 mb-8">
					<Link href="/docs/visual/architecture">
						<Card className="hover:bg-accent transition-colors cursor-pointer h-full">
							<CardContent className="pt-6">
								<div className="flex items-start gap-4">
									<div className="p-3 bg-primary/10 rounded-lg">
										<Network className="h-6 w-6 text-primary" />
									</div>
									<div className="flex-1">
										<h3 className="text-xl font-semibold mb-2 text-foreground">
											System Architecture
										</h3>
										<p className="text-sm text-muted-foreground mb-4">
											See how all the pieces fit together - servers, databases, and integrations
										</p>
										<div className="flex items-center text-primary text-sm font-medium">
											Explore <ArrowRight className="h-4 w-4 ml-2" />
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</Link>

					<Link href="/docs/visual/data-flow">
						<Card className="hover:bg-accent transition-colors cursor-pointer h-full">
							<CardContent className="pt-6">
								<div className="flex items-start gap-4">
									<div className="p-3 bg-green-500/10 rounded-lg">
										<GitBranch className="h-6 w-6 text-green-600 dark:text-green-400" />
									</div>
									<div className="flex-1">
										<h3 className="text-xl font-semibold mb-2 text-foreground">
											Data Flow
										</h3>
										<p className="text-sm text-muted-foreground mb-4">
											Follow how contacts, messages, and calls move between systems
										</p>
										<div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
											Explore <ArrowRight className="h-4 w-4 ml-2" />
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</Link>

					<Link href="/docs/visual/integrations">
						<Card className="hover:bg-accent transition-colors cursor-pointer h-full">
							<CardContent className="pt-6">
								<div className="flex items-start gap-4">
									<div className="p-3 bg-primary/10 rounded-lg">
										<Plug className="h-6 w-6 text-primary" />
									</div>
									<div className="flex-1">
										<h3 className="text-xl font-semibold mb-2 text-foreground">
											Integrations
										</h3>
										<p className="text-sm text-muted-foreground mb-4">
											Learn about GHL, Aloware, and Verity connections and their status
										</p>
										<div className="flex items-center text-primary text-sm font-medium">
											Explore <ArrowRight className="h-4 w-4 ml-2" />
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</Link>

					<Link href="/docs/visual/workflows">
						<Card className="hover:bg-accent transition-colors cursor-pointer h-full">
							<CardContent className="pt-6">
								<div className="flex items-start gap-4">
									<div className="p-3 bg-primary/10 rounded-lg">
										<Workflow className="h-6 w-6 text-primary" />
									</div>
									<div className="flex-1">
										<h3 className="text-xl font-semibold mb-2 text-foreground">
											Workflows
										</h3>
										<p className="text-sm text-muted-foreground mb-4">
											Understand how automated workflows help our voice agents
										</p>
										<div className="flex items-center text-primary text-sm font-medium">
											Explore <ArrowRight className="h-4 w-4 ml-2" />
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</Link>
				</div>

				{/* Quick Links */}
				<div className="grid md:grid-cols-2 gap-6">
					<Link href="/docs/visual/status">
						<Card className="hover:bg-accent transition-colors cursor-pointer">
							<CardContent className="pt-6">
								<div className="flex items-center gap-4">
									<Activity className="h-8 w-8 text-green-600 dark:text-green-400" />
									<div>
										<h3 className="text-lg font-semibold mb-1 text-foreground">
											System Status
										</h3>
										<p className="text-sm text-muted-foreground">
											View real-time system health and integration status
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</Link>

					<Link href="/docs/visual/events">
						<Card className="hover:bg-accent transition-colors cursor-pointer">
							<CardContent className="pt-6">
								<div className="flex items-center gap-4">
									<BookOpen className="h-8 w-8 text-primary" />
									<div>
										<h3 className="text-lg font-semibold mb-1 text-foreground">
											Event Explorer
										</h3>
										<p className="text-sm text-muted-foreground">
											Browse recent webhook events and sync operations
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</Link>
				</div>

				{/* Footer */}
				<div className="mt-12 text-center text-sm text-muted-foreground">
					<p>
						For technical documentation, see the{" "}
						<Link
							href="https://github.com/diversyfund-tech/df-middleware"
							className="text-primary hover:underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub repository
						</Link>
						.
					</p>
				</div>
			</div>
		</div>
	);
}
