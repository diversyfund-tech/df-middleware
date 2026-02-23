/**
 * Knowledge Base Hub
 * 
 * Main entry point for written knowledge base documentation.
 * Designed for non-technical staff to understand DF-Middleware in plain language.
 */

"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	BookOpen,
	ArrowRight,
	HelpCircle,
	Settings,
	Users,
	MessageSquare,
	Workflow,
	AlertCircle,
	FileText,
	Search,
} from "lucide-react";

const documents = [
	{
		id: "01-getting-started",
		title: "Getting Started",
		description: "Learn what DF-Middleware is and why we use it",
		icon: BookOpen,
		color: "cyan",
		category: "Understanding the System",
	},
	{
		id: "02-how-it-works",
		title: "How It Works",
		description: "Understand synchronization and data flow in simple terms",
		icon: Settings,
		color: "blue",
		category: "Understanding the System",
	},
	{
		id: "03-connected-systems",
		title: "Connected Systems",
		description: "Learn about each system we connect to",
		icon: Users,
		color: "green",
		category: "Understanding the System",
	},
	{
		id: "04-common-scenarios",
		title: "Common Scenarios",
		description: "Real-world examples of how the system works",
		icon: MessageSquare,
		color: "purple",
		category: "Daily Operations",
	},
	{
		id: "05-workflows-explained",
		title: "Workflows Explained",
		description: "Learn about automated workflows",
		icon: Workflow,
		color: "orange",
		category: "Daily Operations",
	},
	{
		id: "06-troubleshooting",
		title: "Troubleshooting",
		description: "Common issues and solutions",
		icon: AlertCircle,
		color: "red",
		category: "Problem Solving",
	},
	{
		id: "07-faq",
		title: "Frequently Asked Questions",
		description: "Answers to common questions",
		icon: HelpCircle,
		color: "yellow",
		category: "Problem Solving",
	},
	{
		id: "08-glossary",
		title: "Glossary",
		description: "Plain language definitions of terms",
		icon: FileText,
		color: "indigo",
		category: "Reference",
	},
];

const categories = [
	"Understanding the System",
	"Daily Operations",
	"Problem Solving",
	"Reference",
];

export default function KnowledgeBasePage() {
	const getColorClasses = (color: string) => {
		const colors: Record<string, { bg: string; icon: string; border: string }> = {
			cyan: {
				bg: "bg-cyan-500/20",
				icon: "text-cyan-400",
				border: "hover:border-cyan-500/30",
			},
			blue: {
				bg: "bg-blue-500/20",
				icon: "text-blue-400",
				border: "hover:border-blue-500/30",
			},
			green: {
				bg: "bg-green-500/20",
				icon: "text-green-400",
				border: "hover:border-green-500/30",
			},
			purple: {
				bg: "bg-purple-500/20",
				icon: "text-purple-400",
				border: "hover:border-purple-500/30",
			},
			orange: {
				bg: "bg-orange-500/20",
				icon: "text-orange-400",
				border: "hover:border-orange-500/30",
			},
			red: {
				bg: "bg-red-500/20",
				icon: "text-red-400",
				border: "hover:border-red-500/30",
			},
			yellow: {
				bg: "bg-yellow-500/20",
				icon: "text-yellow-400",
				border: "hover:border-yellow-500/30",
			},
			indigo: {
				bg: "bg-indigo-500/20",
				icon: "text-indigo-400",
				border: "hover:border-indigo-500/30",
			},
		};
		return colors[color] || colors.cyan;
	};

	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-12 max-w-7xl">
				{/* Header */}
				<div className="mb-12 text-center">
					<h1 className="text-4xl font-bold mb-4 text-foreground">
						DF-Middleware Knowledge Base
					</h1>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Everything you need to know about DF-Middleware, explained in plain language for non-technical staff
					</p>
				</div>

				{/* Quick Overview */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>What is DF-Middleware?</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground mb-4">
							DF-Middleware is the "behind-the-scenes" system that keeps all your business tools talking to each other.
							Think of it as a translator that helps GoHighLevel, Aloware, Verity, and our texting system share
							information automatically.
						</p>
						<div className="grid md:grid-cols-3 gap-4 mt-6">
							<Card>
								<CardContent className="pt-6 text-center">
									<div className="text-3xl font-bold text-primary mb-2">4</div>
									<div className="text-sm text-muted-foreground">Connected Systems</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-6 text-center">
									<div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">8</div>
									<div className="text-sm text-muted-foreground">Knowledge Base Guides</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-6 text-center">
									<div className="text-3xl font-bold text-primary mb-2">24/7</div>
									<div className="text-sm text-muted-foreground">Automatic Sync</div>
								</CardContent>
							</Card>
						</div>
					</CardContent>
				</Card>

				{/* Documents by Category */}
				{categories.map((category) => {
					const categoryDocs = documents.filter((doc) => doc.category === category);
					if (categoryDocs.length === 0) return null;

					return (
						<div key={category} className="mb-8">
							<h2 className="text-2xl font-semibold mb-4 text-foreground">
								{category}
							</h2>
							<div className="grid md:grid-cols-2 gap-6">
								{categoryDocs.map((doc) => {
									const colors = getColorClasses(doc.color);
									const Icon = doc.icon;
									return (
										<Link key={doc.id} href={`/docs/knowledge-base/${doc.id}`}>
											<Card className="hover:bg-accent transition-colors cursor-pointer h-full">
												<CardContent className="pt-6">
													<div className="flex items-start gap-4">
														<div className={`p-3 ${colors.bg} rounded-lg`}>
															<Icon className={`h-6 w-6 ${colors.icon}`} />
														</div>
														<div className="flex-1">
															<h3 className="text-xl font-semibold mb-2 text-foreground">
																{doc.title}
															</h3>
															<p className="text-sm text-muted-foreground mb-4">
																{doc.description}
															</p>
															<div className={`flex items-center ${colors.icon} text-sm font-medium`}>
																Read Guide <ArrowRight className="h-4 w-4 ml-2" />
															</div>
														</div>
													</div>
												</CardContent>
											</Card>
										</Link>
									);
								})}
							</div>
						</div>
					);
				})}

				{/* Quick Links */}
				<Card className="mt-8">
					<CardHeader>
						<CardTitle>Quick Links</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid md:grid-cols-2 gap-4">
							<Link href="/docs/visual">
								<Card className="hover:bg-accent transition-colors cursor-pointer">
									<CardContent className="pt-6">
										<div className="flex items-center gap-2 text-foreground">
											<Search className="h-5 w-5" />
											<span className="font-medium">Visual Documentation</span>
										</div>
										<p className="text-sm text-muted-foreground mt-2">
											See system architecture and data flows visually
										</p>
									</CardContent>
								</Card>
							</Link>
							<Link href="/docs/knowledge-base/06-troubleshooting">
								<Card className="hover:bg-accent transition-colors cursor-pointer">
									<CardContent className="pt-6">
										<div className="flex items-center gap-2 text-foreground">
											<AlertCircle className="h-5 w-5" />
											<span className="font-medium">Need Help?</span>
										</div>
										<p className="text-sm text-muted-foreground mt-2">
											Check the troubleshooting guide for common issues
										</p>
									</CardContent>
								</Card>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
