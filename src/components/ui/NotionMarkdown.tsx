"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface NotionMarkdownProps {
	content: string;
	className?: string;
}

/**
 * Notion-style markdown renderer - clean, formatted text without raw markdown symbols
 */
export default function NotionMarkdown({ content, className }: NotionMarkdownProps) {
	return (
		<div className={cn("notion-markdown prose prose-sm max-w-none dark:prose-invert", className)}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					// Headings - styled but not too large
					h1: ({ children }) => (
						<h1 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-foreground">{children}</h1>
					),
					h2: ({ children }) => (
						<h2 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-foreground">{children}</h2>
					),
					h3: ({ children }) => (
						<h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0 text-foreground">{children}</h3>
					),
					// Paragraphs - clean spacing
					p: ({ children }) => <p className="mb-2 last:mb-0 text-sm leading-relaxed">{children}</p>,
					// Lists - clean bullets
					ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-sm">{children}</ul>,
					ol: ({ children }) => (
						<ol className="list-decimal list-inside mb-2 space-y-1 text-sm">{children}</ol>
					),
					li: ({ children }) => <li className="text-sm">{children}</li>,
					// Bold and italic - subtle styling
					strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
					em: ({ children }) => <em className="italic">{children}</em>,
					// Code - subtle background
					code: ({ children, className }) => {
						const isInline = !className;
						return isInline ? (
							<code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
						) : (
							<code className={className}>{children}</code>
						);
					},
					// Links - styled but not too prominent
					a: ({ children, href }) => (
						<a href={href} className="text-cyan-400 hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer">
							{children}
						</a>
					),
					// Blockquotes - subtle border
					blockquote: ({ children }) => (
						<blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 italic text-muted-foreground">
							{children}
						</blockquote>
					),
					// Horizontal rule - subtle
					hr: () => <hr className="border-t border-muted-foreground/20 my-3" />,
					// Tables - clean styling
					table: ({ children }) => (
						<div className="overflow-x-auto my-2">
							<table className="min-w-full border-collapse text-sm">{children}</table>
						</div>
					),
					thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
					tbody: ({ children }) => <tbody>{children}</tbody>,
					tr: ({ children }) => <tr className="border-b border-muted-foreground/20">{children}</tr>,
					th: ({ children }) => (
						<th className="px-3 py-2 text-left font-semibold text-foreground">{children}</th>
					),
					td: ({ children }) => <td className="px-3 py-2">{children}</td>,
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
