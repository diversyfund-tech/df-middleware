/**
 * Knowledge Base Document Viewer
 * 
 * Displays individual knowledge base documents with markdown rendering.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { notFound } from "next/navigation";
import Link from "next/link";
import NotionMarkdown from "@/components/ui/NotionMarkdown";
import GlassPanel from "@/components/ui/GlassPanel";
import { ArrowLeft, BookOpen } from "lucide-react";

const validSlugs = [
	"01-getting-started",
	"02-how-it-works",
	"03-connected-systems",
	"04-common-scenarios",
	"05-workflows-explained",
	"06-troubleshooting",
	"07-faq",
	"08-glossary",
	"README",
];

interface PageProps {
	params: Promise<{ slug: string }>;
}

export default async function KnowledgeBaseDocumentPage({ params }: PageProps) {
	const { slug } = await params;

	if (!validSlugs.includes(slug)) {
		notFound();
	}

	let content: string;
	try {
		const filePath = join(process.cwd(), "docs", "knowledge-base", `${slug}.md`);
		content = await readFile(filePath, "utf-8");
	} catch (error) {
		console.error(`Error reading knowledge base file: ${error}`);
		notFound();
	}

	const titles: Record<string, string> = {
		"01-getting-started": "Getting Started",
		"02-how-it-works": "How It Works",
		"03-connected-systems": "Connected Systems",
		"04-common-scenarios": "Common Scenarios",
		"05-workflows-explained": "Workflows Explained",
		"06-troubleshooting": "Troubleshooting",
		"07-faq": "Frequently Asked Questions",
		"08-glossary": "Glossary",
		README: "Knowledge Base Index",
	};

	const title = titles[slug] || "Knowledge Base";

	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-12 max-w-4xl">
				{/* Back Button */}
				<Link
					href="/docs/knowledge-base"
					className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-6 transition-colors"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Knowledge Base
				</Link>

				{/* Document Content */}
				<GlassPanel variant="default" className="p-8">
					{/* Title */}
					<div className="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
						<div className="flex items-center gap-3 mb-2">
							<BookOpen className="h-6 w-6 text-cyan-400" />
							<h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
						</div>
					</div>

					{/* Markdown Content */}
					<div className="prose prose-zinc dark:prose-invert max-w-none">
						<NotionMarkdown content={content} />
					</div>
				</GlassPanel>

				{/* Navigation Footer */}
				<div className="mt-8 flex justify-between items-center">
					<Link
						href="/docs/knowledge-base"
						className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
					>
						← All Documents
					</Link>
					<Link
						href="/docs/visual"
						className="text-cyan-400 hover:text-cyan-300 transition-colors"
					>
						Visual Documentation →
					</Link>
				</div>
			</div>
		</div>
	);
}
