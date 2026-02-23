/**
 * Agent Management API - Individual Agent
 * 
 * GET /api/workflows/agents/[agentId] - Get agent config
 * PUT /api/workflows/agents/[agentId] - Update agent config
 * DELETE /api/workflows/agents/[agentId] - Delete agent config
 */

import { NextRequest, NextResponse } from "next/server";
import {
	getAgentConfigByAgentId,
	updateAgentConfig,
	deleteAgentConfig,
} from "@/lib/elevenlabs/agents/agent-registry";
import { validateAgentConfig } from "@/lib/elevenlabs/agents/agent-config";

export async function GET(
	req: NextRequest,
	{ params }: { params: { agentId: string } }
) {
	try {
		const { agentId } = params;

		const agent = await getAgentConfigByAgentId(agentId);

		if (!agent) {
			return NextResponse.json(
				{ error: "Agent not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			id: agent.id,
			agentId: agent.agentId,
			name: agent.name,
			workflowType: agent.workflowType,
			systemPrompt: agent.systemPrompt,
			isActive: agent.isActive,
			maxConcurrentCalls: agent.maxConcurrentCalls,
			createdAt: agent.createdAt,
			updatedAt: agent.updatedAt,
		});
	} catch (error: any) {
		console.error("[workflows.agents] Error getting agent:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: { agentId: string } }
) {
	try {
		const { agentId } = params;
		const body = await req.json();

		// Check if agent exists
		const existing = await getAgentConfigByAgentId(agentId);
		if (!existing) {
			return NextResponse.json(
				{ error: "Agent not found" },
				{ status: 404 }
			);
		}

		// Validate update (don't require all fields)
		const updateData = {
			...body,
			agentId: existing.agentId, // Don't allow changing agentId
		};

		// Partial validation - only validate provided fields
		if (body.workflowType && !["sales", "support", "appointment", "custom"].includes(body.workflowType)) {
			return NextResponse.json(
				{ error: "Invalid workflowType" },
				{ status: 400 }
			);
		}

		// Update agent
		await updateAgentConfig(agentId, updateData);

		// Return updated agent
		const updated = await getAgentConfigByAgentId(agentId);

		return NextResponse.json({
			success: true,
			agent: updated,
		});
	} catch (error: any) {
		console.error("[workflows.agents] Error updating agent:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: { agentId: string } }
) {
	try {
		const { agentId } = params;

		// Check if agent exists
		const existing = await getAgentConfigByAgentId(agentId);
		if (!existing) {
			return NextResponse.json(
				{ error: "Agent not found" },
				{ status: 404 }
			);
		}

		// Delete agent
		await deleteAgentConfig(agentId);

		return NextResponse.json({
			success: true,
			message: "Agent deleted successfully",
		});
	} catch (error: any) {
		console.error("[workflows.agents] Error deleting agent:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
