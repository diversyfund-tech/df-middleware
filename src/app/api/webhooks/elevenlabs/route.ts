/**
 * ElevenLabs Webhook Handler
 * 
 * Handles function calling webhooks from ElevenLabs.
 * Maps ElevenLabs function calls to MCP tools and executes them via workflow engine.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { mapElevenLabsFunctionToMCPTool, validateFunctionCall } from "@/lib/elevenlabs/function-adapter";
import { getWorkflowForAgent } from "@/lib/elevenlabs/agents/workflow-resolver";
import {
	createWorkflowExecution,
	executeWorkflowStep,
	getWorkflowExecution,
} from "@/lib/workflows/workflow-engine";
import { executeTool } from "@/lib/mcp/tool-executor";
import { getClerkSessionToken } from "@/auth/clerk-token-manager";
import { bookAndSyncAppointment } from "@/lib/workflows/appointments/calendar-sync";
import { validateAppointmentParams } from "@/lib/workflows/appointments/appointment-validator";
import { executeWithCircuitBreaker } from "@/lib/workflows/error-handler";

/**
 * Verify ElevenLabs webhook signature (if secret is configured)
 */
function verifyWebhookSignature(req: NextRequest): boolean {
	const secret = env.ELEVENLABS_WEBHOOK_SECRET;
	if (!secret) {
		// If no secret configured, allow all requests (for development)
		return true;
	}

	// TODO: Implement signature verification based on ElevenLabs documentation
	// For now, return true if secret exists
	const signature = req.headers.get("x-elevenlabs-signature") || req.headers.get("signature");
	
	// Basic verification - enhance based on ElevenLabs docs
	return signature !== null;
}

export interface ElevenLabsWebhookPayload {
	agentId: string; // ElevenLabs agent ID
	callId?: string; // Call ID
	phoneNumber?: string; // Phone number called
	functionCall?: {
		name: string;
		arguments: string | Record<string, unknown>;
	};
	conversationState?: Record<string, unknown>; // Current conversation state
}

export async function POST(req: NextRequest) {
	console.log("[elevenlabs.webhook] Received webhook request");

	try {
		// Verify webhook signature
		if (!verifyWebhookSignature(req)) {
			console.error("[elevenlabs.webhook] Invalid webhook signature");
			return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
		}

		// Parse request body
		const body: ElevenLabsWebhookPayload = await req.json();
		console.log("[elevenlabs.webhook] Webhook payload:", JSON.stringify(body, null, 2));

		const { agentId, functionCall, callId, phoneNumber, conversationState } = body;

		if (!agentId) {
			return NextResponse.json({ error: "agentId is required" }, { status: 400 });
		}

		// If no function call, this might be a status update or other event
		if (!functionCall) {
			console.log("[elevenlabs.webhook] No function call in payload, returning success");
			return NextResponse.json({ success: true, message: "Webhook received" });
		}

		// Validate function call
		const validation = validateFunctionCall(functionCall);
		if (!validation.valid) {
			return NextResponse.json(
				{ error: `Invalid function call: ${validation.error}` },
				{ status: 400 }
			);
		}

		// Get workflow for agent
		const workflowDef = await getWorkflowForAgent(agentId);
		if (!workflowDef) {
			return NextResponse.json(
				{ error: `No workflow found for agent ${agentId}` },
				{ status: 404 }
			);
		}

		// Get or create workflow execution
		// For now, create a new execution for each function call
		// TODO: In the future, track executions by callId to resume workflows
		const executionId = await createWorkflowExecution(agentId, workflowDef.type, {
			callId,
			phoneNumber,
		});

		// Map ElevenLabs function to MCP tool
		const mcpToolCall = mapElevenLabsFunctionToMCPTool(functionCall);

		// Handle special case: appointment booking (uses GHL API directly)
		if (mcpToolCall.toolName === "book_appointment") {
			return await handleAppointmentBooking(executionId, mcpToolCall.args, workflowDef);
		}

		// Execute MCP tool via workflow engine
		// First, determine which step this tool corresponds to
		const stepDef = workflowDef.steps.find(s => s.toolName === mcpToolCall.toolName);
		const stepName = stepDef?.name || `tool_${mcpToolCall.toolName}`;

		// Execute workflow step
		const result = await executeWithCircuitBreaker(
			"workflow-execution",
			() => executeWorkflowStep(executionId, workflowDef, stepName, mcpToolCall.args)
		);

		// Map result back to ElevenLabs format
		const elevenLabsResult = {
			result: JSON.stringify({
				success: result.status === "completed",
				data: result.toolResult?.data,
				error: result.error,
				nextStep: result.nextStep,
			}),
		};

		return NextResponse.json(elevenLabsResult);
	} catch (error: any) {
		console.error("[elevenlabs.webhook] Error processing webhook:", error);
		return NextResponse.json(
			{
				error: error.message || "Internal server error",
				result: JSON.stringify({
					success: false,
					error: error.message || "Internal server error",
				}),
			},
			{ status: 500 }
		);
	}
}

/**
 * Handle appointment booking (special case - uses GHL API directly)
 */
async function handleAppointmentBooking(
	executionId: string,
	args: Record<string, unknown>,
	workflowDef: Awaited<ReturnType<typeof getWorkflowForAgent>>
): Promise<NextResponse> {
	if (!workflowDef) {
		return NextResponse.json({ error: "Workflow definition not found" }, { status: 404 });
	}

	// Get execution to access collected data
	const execution = await getWorkflowExecution(executionId);
	if (!execution) {
		return NextResponse.json({ error: "Workflow execution not found" }, { status: 404 });
	}

	const state = (execution.workflowState as { collectedData?: Record<string, unknown>; metadata?: Record<string, unknown> }) || {};
	const collectedData = state.collectedData || {};

	// Extract appointment parameters
	const contactId = (args.contactId || collectedData.contactId) as string;
	const startTime = args.startTime as string;
	const endTime = args.endTime as string;
	const title = args.title as string || `Appointment with ${collectedData.firstName || "Prospect"}`;
	const notes = args.notes as string;

	if (!contactId) {
		return NextResponse.json(
			{
				error: "contactId is required for appointment booking",
				result: JSON.stringify({
					success: false,
					error: "Contact ID is required. Please create contact first.",
				}),
			},
			{ status: 400 }
		);
	}

	// Validate appointment parameters
	const validation = validateAppointmentParams({
		contactId,
		startTime,
		endTime,
		title,
	});

	if (!validation.valid) {
		return NextResponse.json(
			{
				error: validation.errors.join(", "),
				result: JSON.stringify({
					success: false,
					error: validation.errors.join(", "),
					warnings: validation.warnings,
				}),
			},
			{ status: 400 }
		);
	}

	try {
		// Book appointment via GHL API
		const appointmentResult = await executeWithCircuitBreaker(
			"ghl-appointment",
			() => bookAndSyncAppointment({
				contactId,
				startTime,
				endTime,
				title,
				notes,
			})
		);

		// Update workflow state with appointment ID
		const { updateWorkflowState } = await import("@/lib/workflows/workflow-engine");
		const newState = {
			step: state.step || "send_confirmation",
			collectedData: {
				...collectedData,
				appointmentId: appointmentResult.appointment.id,
			},
			decisions: state.decisions || {},
			metadata: {
				...state.metadata,
				appointmentId: appointmentResult.appointment.id,
			},
		};

		await updateWorkflowState(executionId, newState);

		return NextResponse.json({
			result: JSON.stringify({
				success: true,
				data: {
					appointmentId: appointmentResult.appointment.id,
					startTime: appointmentResult.appointment.startTime,
					endTime: appointmentResult.appointment.endTime,
					title: appointmentResult.appointment.title,
				},
			}),
		});
	} catch (error: any) {
		console.error("[elevenlabs.webhook] Error booking appointment:", error);
		return NextResponse.json(
			{
				error: error.message || "Failed to book appointment",
				result: JSON.stringify({
					success: false,
					error: error.message || "Failed to book appointment",
				}),
			},
			{ status: 500 }
		);
	}
}
