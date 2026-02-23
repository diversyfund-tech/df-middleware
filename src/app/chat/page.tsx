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

type Message = {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	options?: Array<{ label: string; intent: string }>;
};

export default function ChatPage() {
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
				content: `Hello! I'm your AI assistant connected to the Verity API through the MCP server. I can help you execute any goal or task by calling the appropriate API endpoints.

I can help you with:
- Making phone calls and managing communications
- Managing contacts and conversations
- Executing any Verity API endpoint
- And much more!

What would you like to accomplish today?`,
				timestamp: new Date(),
			};
			setMessages([initialMessage]);
		}
	}, [hasStarted, messages.length, isLoading]);

	const sendMessage = async (customMessage?: string) => {
		const messageToSend = (customMessage || input).trim();
		if (!messageToSend || isLoading) {
			console.log("[Chat] sendMessage blocked:", { messageToSend, isLoading });
			return;
		}

		console.log("[Chat] Sending message:", messageToSend);

		// Add user message
		const userMessage: Message = { role: "user", content: messageToSend, timestamp: new Date() };
		const newMessages: Message[] = [...messages, userMessage];
		
		console.log("[Chat] Setting messages with user message:", newMessages.length);
		setMessages(newMessages);
		if (!customMessage) {
			setInput("");
		}
		setIsLoading(true);

		// Add placeholder assistant message for streaming
		setMessages((prev) => {
			const updated = [...prev, { role: "assistant", content: "", timestamp: new Date() }];
			console.log("[Chat] Added placeholder assistant message, total:", updated.length);
			return updated;
		});

		try {
			const requestBody = {
				messages: newMessages.map((m) => ({
					role: m.role,
					content: m.content,
				})),
			};
			
			console.log("[Chat] Making API request with messages:", requestBody.messages.length);

			const response = await fetch("/api/mcp/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			});

			console.log("[Chat] Response status:", response.status, response.statusText);

			if (!response.ok) {
				const errorText = await response.text();
				console.error("[Chat] API error response:", errorText);
				throw new Error(`Failed to fetch: ${response.statusText} - ${errorText}`);
			}

			if (!response.body) {
				throw new Error("Response body is null");
			}

			// Parse SSE stream
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let assistantText = "";
			let hasReceivedData = false;

			console.log("[Chat] Starting to read SSE stream");

			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					console.log("[Chat] Stream done, final text length:", assistantText.length);
					break;
				}

				const chunk = decoder.decode(value, { stream: true });
				console.log("[Chat] Received chunk:", chunk.substring(0, 100));
				
				for (const line of chunk.split("\n")) {
					if (!line.startsWith("data: ")) continue;
					const data = line.slice(6).trim();
					if (!data || data === "[DONE]") continue;

					try {
						const evt = JSON.parse(data);
						console.log("[Chat] Parsed SSE event:", evt.type);
						
						if (evt.type === "text.delta") {
							hasReceivedData = true;
							assistantText += evt.delta;
							setMessages((curr) => {
								const copy = [...curr];
								const lastMsg = copy[copy.length - 1];
								if (lastMsg?.role === "assistant") {
									copy[copy.length - 1] = {
										...lastMsg,
										content: assistantText,
									};
								} else {
									copy.push({
										role: "assistant",
										content: assistantText,
										timestamp: new Date(),
									});
								}
								return copy;
							});
						} else if (evt.type === "options") {
							console.log("[Chat] Received options:", evt.options);
							hasReceivedData = true;
							setMessages((curr) => {
								const copy = [...curr];
								const lastMsg = copy[copy.length - 1];
								if (lastMsg?.role === "assistant") {
									copy[copy.length - 1] = {
										...lastMsg,
										content: assistantText || lastMsg.content,
										options: evt.options,
									};
								} else {
									copy.push({
										role: "assistant",
										content: assistantText,
										options: evt.options,
										timestamp: new Date(),
									});
								}
								return copy;
							});
						} else if (evt.type === "error") {
							console.error("[Chat] SSE error event:", evt);
							const errorMessage = evt.message || "An error occurred. Please try again.";
							assistantText = errorMessage;
							setMessages((curr) => {
								const copy = [...curr];
								const lastMsg = copy[copy.length - 1];
								if (lastMsg?.role === "assistant") {
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
							break; // Stop reading stream on error
						}
					} catch (e) {
						console.warn("[Chat] JSON parse error:", e, "Line:", line);
						// Ignore JSON parse errors for incomplete chunks
					}
				}
			}

			if (!hasReceivedData && !assistantText) {
				console.warn("[Chat] No data received from stream");
				setMessages((curr) => {
					const copy = [...curr];
					const lastMsg = copy[copy.length - 1];
					if (lastMsg?.role === "assistant" && !lastMsg.content) {
						copy[copy.length - 1] = {
							...lastMsg,
							content: "No response received. Please try again.",
						};
					}
					return copy;
				});
			}
		} catch (error) {
			console.error("[Chat] Error:", error);
			setMessages((curr) => {
				const copy = [...curr];
				const lastMsg = copy[copy.length - 1];
				const errorMessage = error instanceof Error ? error.message : "Sorry, there was an error. Please try again.";
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
			console.log("[Chat] sendMessage complete");
		}
	};

	const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;
		sendMessage();
	};

	return (
		<div className="h-screen flex flex-col">
			<GlassPanel variant="default" className="flex-1 flex flex-col p-0 overflow-hidden m-4">
				<div className="p-4 border-b border-white/10">
					<h2 className="text-lg font-semibold">AI Assistant</h2>
					<p className="text-sm text-muted-foreground">
						Chat with AI to execute your goals through Verity API
					</p>
				</div>
				<ScrollArea className="flex-1 px-4 py-4">
					<div className="space-y-4">
						{messages.length === 0 && (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<AnimatedAIAvatar isThinking={true} size="lg" className="mb-4" />
								<p className="text-sm text-muted-foreground">The AI will start the conversation shortly...</p>
							</div>
						)}
						<AnimatePresence mode="popLayout">
							{messages
								.map((message, index) => {
									// Skip empty assistant messages (they're placeholders)
									if (message.role === "assistant" && !message.content.trim()) {
										return null;
									}
									
									const isFirstAssistant = message.role === "assistant" && index === 0;
									return (
										<motion.div
											key={`${message.role}-${index}-${message.timestamp.getTime()}`}
											variants={message.role === "user" ? messageSlideInFromRight : messageSlideInFromLeft}
											initial="initial"
											animate="animate"
											exit="exit"
											className={cn(
												"flex",
												message.role === "user" ? "justify-end" : "justify-start",
											)}
										>
											<div className="flex items-start gap-3 max-w-[80%]">
												{isFirstAssistant && (
													<AnimatedAIAvatar isThinking={false} size="sm" className="flex-shrink-0 mt-1" />
												)}
												<div className="flex flex-col gap-2">
													<GlassPanel
														variant={message.role === "user" ? "default" : "glow"}
														className={cn(
															"px-4 py-3",
															message.role === "user" && "bg-primary/20 border-primary/30",
															message.role === "assistant" && "border-cyan-500/30 shadow-[0_0_15px_rgba(0,150,255,0.2)]",
														)}
													>
														{message.role === "assistant" ? (
															<NotionMarkdown content={message.content} className="text-sm" />
														) : (
															<p className="text-sm whitespace-pre-wrap">{message.content}</p>
														)}
													</GlassPanel>
													{message.role === "assistant" && message.options && message.options.length > 0 && (
														<div className="flex flex-wrap gap-2 mt-2">
															{message.options.map((option, optIdx) => (
																<Button
																	key={optIdx}
																	variant="outline"
																	onClick={() => {
																		// Send the intent directly without setting input
																		sendMessage(option.intent);
																	}}
																	className="text-xs border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all"
																	disabled={isLoading}
																>
																	{option.label}
																</Button>
															))}
														</div>
													)}
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
								<GlassPanel variant="glow" className="px-4 py-3 inline-flex items-center gap-2">
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

				<div className="px-4 pb-4 space-y-3">
					<form onSubmit={handleFormSubmit} className="flex gap-2">
						<Textarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Type your message..."
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
			</GlassPanel>
		</div>
	);
}
