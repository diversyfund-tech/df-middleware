/**
 * Workflow Builder API
 * 
 * AI-powered endpoint for conversational workflow design.
 */

import { NextRequest, NextResponse } from "next/server";
import { processWorkflowBuilderMessage } from "@/lib/workflows/ai-assistant";
import { parseWorkflowFromConversation } from "@/lib/workflows/conversation-parser";
import { validateWorkflow } from "@/lib/workflows/workflow-validator";
import type { WorkflowDefinition } from "@/lib/workflows/types";

export const runtime = "nodejs";

export interface BuilderRequest {
	messages: Array<{ role: "user" | "assistant"; content: string }>;
	workflowType?: WorkflowDefinition["type"];
}

export interface BuilderResponse {
	message: string;
	workflow?: WorkflowDefinition;
	questions?: string[];
	needsClarification: boolean;
	validationErrors?: Array<{ message: string }>;
}

export async function POST(request: NextRequest) {
	try {
		const body: BuilderRequest = await request.json();
		const { messages, workflowType } = body;

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return NextResponse.json(
				{ error: "Messages array is required" },
				{ status: 400 }
			);
		}

		// Process message with AI assistant
		const aiResponse = await processWorkflowBuilderMessage(messages, workflowType);

		// Try to extract workflow from conversation
		const parsed = parseWorkflowFromConversation([
			...messages,
			{ role: "assistant", content: aiResponse.message },
		]);

		// If workflow found, validate it
		let validationErrors: Array<{ message: string }> | undefined;
		if (parsed.workflow) {
			const validation = await validateWorkflow(parsed.workflow);
			if (!validation.valid) {
				validationErrors = validation.errors.map((e) => ({
					message: e.message,
				}));
			}
		}

		const response: BuilderResponse = {
			message: aiResponse.message,
			workflow: parsed.workflow || aiResponse.workflow,
			questions: aiResponse.questions,
			needsClarification: aiResponse.needsClarification || !!validationErrors,
			validationErrors,
		};

		return NextResponse.json(response);
	} catch (error: any) {
		console.error("[workflows/builder] Error:", error);
		return NextResponse.json(
			{
				error: "Failed to process workflow builder request",
				message: error.message || "Unknown error",
			},
			{ status: 500 }
		);
	}
}
