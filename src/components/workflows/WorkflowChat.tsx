/**
 * Workflow Chat Component
 * 
 * Chat interface specifically for workflow building conversations.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import GlassPanel from "@/components/ui/GlassPanel";
import AnimatedAIAvatar from "@/components/ui/AnimatedAIAvatar";
import NotionMarkdown from "@/components/ui/NotionMarkdown";
import { messageSlideInFromRight, messageSlideInFromLeft } from "@/lib/animations";
import type { WorkflowDefinition } from "@/lib/workflows/types";

type Message = {
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
};

interface WorkflowChatProps {
	onWorkflowUpdate?: (workflow: WorkflowDefinition | null) => void;
	onMessageUpdate?: (messages: Array<{ role: "user" | "assistant"; content: string }>) => void;
	workflowType?: WorkflowDefinition["type"];
}

export default function WorkflowChat({
	onWorkflowUpdate,
	onMessageUpdate,
	workflowType,
}: WorkflowChatProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [hasStarted, setHasStarted] = useState(false);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Start conversation with greeting
	useEffect(() => {
		if (!hasStarted && messages.length === 0 && !isLoading) {
			setHasStarted(true);
			const initialMessage: Message = {
				role: "assistant",
				content: `Hello! I'm your AI workflow design assistant. I'll help you think through and design workflows for ElevenLabs voice agents.

I can help you:
- Design workflows step-by-step
- Suggest appropriate MCP tools for each action
- Validate workflow structure
- Generate workflow definitions

What kind of workflow would you like to create? (sales, support, appointment booking, or custom)`,
				timestamp: new Date(),
			};
			setMessages([initialMessage]);
		}
	}, [hasStarted, messages.length, isLoading]);

	const sendMessage = async (customMessage?: string) => {
		const messageToSend = (customMessage || input).trim();
		if (!messageToSend || isLoading) return;

		// Add user message
		const userMessage: Message = {
			role: "user",
			content: messageToSend,
			timestamp: new Date(),
		};
		const newMessages: Message[] = [...messages, userMessage];
		setMessages(newMessages);
		if (!customMessage) {
			setInput("");
		}
		setIsLoading(true);

		// Add placeholder assistant message
		setMessages((prev) => [
			...prev,
			{ role: "assistant", content: "", timestamp: new Date() },
		]);

		try {
			const response = await fetch("/api/workflows/builder", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: newMessages.map((m) => ({
						role: m.role,
						content: m.content,
					})),
					workflowType,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to fetch: ${response.statusText} - ${errorText}`);
			}

			const data = await response.json();
			const assistantMessage = data.message || "No response received.";

			// Update assistant message
			const updatedMessages = (() => {
				const copy = [...newMessages];
				const lastMsg = copy[copy.length - 1];
				if (lastMsg?.role === "assistant") {
					copy[copy.length - 1] = {
						...lastMsg,
						content: assistantMessage,
					};
				} else {
					copy.push({
						role: "assistant",
						content: assistantMessage,
						timestamp: new Date(),
					});
				}
				return copy;
			})();

			setMessages(updatedMessages);

			// Notify parent of message updates (for parsing workflow)
			if (onMessageUpdate) {
				onMessageUpdate(
					updatedMessages.map((m) => ({
						role: m.role,
						content: m.content,
					}))
				);
			}

			// Notify parent of workflow update if directly provided
			if (data.workflow && onWorkflowUpdate) {
				onWorkflowUpdate(data.workflow);
			}
		} catch (error) {
			console.error("[WorkflowChat] Error:", error);
			setMessages((curr) => {
				const copy = [...curr];
				const lastMsg = copy[copy.length - 1];
				const errorMessage =
					error instanceof Error
						? error.message
						: "Sorry, there was an error. Please try again.";
				if (lastMsg?.role === "assistant" && !lastMsg.content) {
					copy[copy.length - 1] = {
						...lastMsg,
						content: errorMessage,
					};
				} else {
					copy.push({
						role: "assistant",
						content: errorMessage,
						timestamp: new Date(),
					});
				}
				return copy;
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;
		sendMessage();
	};

	return (
		<div className="h-full flex flex-col">
			<ScrollArea className="flex-1 px-4 py-4">
				<div className="space-y-4">
					{messages.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<AnimatedAIAvatar isThinking={true} size="lg" className="mb-4" />
							<p className="text-sm text-muted-foreground">
								The AI will start the conversation shortly...
							</p>
						</div>
					)}
					<AnimatePresence mode="popLayout">
						{messages
							.map((message, index) => {
								if (message.role === "assistant" && !message.content.trim()) {
									return null;
								}

								const isFirstAssistant =
									message.role === "assistant" && index === 0;
								return (
									<motion.div
										key={`${message.role}-${index}-${message.timestamp.getTime()}`}
										variants={
											message.role === "user"
												? messageSlideInFromRight
												: messageSlideInFromLeft
										}
										initial="initial"
										animate="animate"
										exit="exit"
										className={cn(
											"flex",
											message.role === "user" ? "justify-end" : "justify-start"
										)}
									>
										<div className="flex items-start gap-3 max-w-[85%]">
											{isFirstAssistant && (
												<AnimatedAIAvatar
													isThinking={false}
													size="sm"
													className="flex-shrink-0 mt-1"
												/>
											)}
											<div className="flex flex-col gap-2">
												<GlassPanel
													variant={
														message.role === "user" ? "default" : "glow"
													}
													className={cn(
														"px-4 py-3",
														message.role === "user" &&
															"bg-primary/20 border-primary/30",
														message.role === "assistant" &&
															"border-cyan-500/30 shadow-[0_0_15px_rgba(0,150,255,0.2)]"
													)}
												>
													{message.role === "assistant" ? (
														<NotionMarkdown
															content={message.content}
															className="text-sm"
														/>
													) : (
														<p className="text-sm whitespace-pre-wrap">
															{message.content}
														</p>
													)}
												</GlassPanel>
											</div>
										</div>
									</motion.div>
								);
							})
							.filter(Boolean)}
					</AnimatePresence>
					{isLoading && (
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="flex justify-start"
						>
							<GlassPanel
								variant="glow"
								className="px-4 py-3 inline-flex items-center gap-2"
							>
								<Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
								<div className="flex gap-1">
									<motion.span
										animate={{ opacity: [0.3, 1, 0.3] }}
										transition={{ duration: 1, repeat: Infinity, delay: 0 }}
										className="text-cyan-400"
									>
										•
									</motion.span>
									<motion.span
										animate={{ opacity: [0.3, 1, 0.3] }}
										transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
										className="text-cyan-400"
									>
										•
									</motion.span>
									<motion.span
										animate={{ opacity: [0.3, 1, 0.3] }}
										transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
										className="text-cyan-400"
									>
										•
									</motion.span>
								</div>
							</GlassPanel>
						</motion.div>
					)}
					<div ref={messagesEndRef} />
				</div>
			</ScrollArea>

			<div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-4">
				<form onSubmit={handleFormSubmit} className="flex gap-2">
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Describe your workflow..."
						className="flex-1 min-h-[60px] bg-background/50 backdrop-blur-sm border-white/20"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								if (input.trim() && !isLoading) {
									sendMessage();
								}
							}
						}}
						disabled={isLoading}
					/>
					<Button type="submit" disabled={isLoading || !input.trim()} size="icon">
						{isLoading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Send className="h-4 w-4" />
						)}
					</Button>
				</form>
			</div>
		</div>
	);
}
