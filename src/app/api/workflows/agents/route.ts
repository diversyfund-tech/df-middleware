/**
 * Agent Management API
 * 
 * GET /api/workflows/agents - List all agents
 * POST /api/workflows/agents - Create new agent
 */

import { NextRequest, NextResponse } from "next/server";
import {
	listAgentConfigs,
	createAgentConfig,
} from "@/lib/elevenlabs/agents/agent-registry";
import { validateAgentConfig } from "@/lib/elevenlabs/agents/agent-config";

export async function GET(req: NextRequest) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const activeOnly = searchParams.get("activeOnly") === "true";

		const agents = await listAgentConfigs({ activeOnly });

		return NextResponse.json({
			agents: agents.map(agent => ({
				id: agent.id,
				agentId: agent.agentId,
				name: agent.name,
				workflowType: agent.workflowType,
				isActive: agent.isActive,
				maxConcurrentCalls: agent.maxConcurrentCalls,
				createdAt: agent.createdAt,
				updatedAt: agent.updatedAt,
			})),
		});
	} catch (error: any) {
		console.error("[workflows.agents] Error listing agents:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		// Validate agent config
		const validation = validateAgentConfig(body);
		if (!validation.valid) {
			return NextResponse.json(
				{ error: `Invalid agent configuration: ${validation.error}` },
				{ status: 400 }
			);
		}

		// Create agent
		const id = await createAgentConfig(validation.data!);

		return NextResponse.json({
			success: true,
			id,
			agent: validation.data,
		}, { status: 201 });
	} catch (error: any) {
		console.error("[workflows.agents] Error creating agent:", error);
		
		// Handle duplicate agent ID
		if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
			return NextResponse.json(
				{ error: "Agent with this ID already exists" },
				{ status: 409 }
			);
		}

		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
