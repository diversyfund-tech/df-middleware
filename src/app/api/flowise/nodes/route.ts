/**
 * Flowise Nodes API Endpoint
 * 
 * Provides Flowise with node definitions for visual workflow building.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllFlowiseNodes, getFlowiseNodesByCategory, getFlowiseNodeByName } from "@/lib/flowise/nodes";
import type { FlowiseNodeCategory } from "@/lib/flowise/nodes";

/**
 * GET /api/flowise/nodes
 * 
 * Returns all available Flowise node definitions.
 * Query parameters:
 * - category: Filter by category
 * - name: Get specific node by name
 */
export async function GET(req: NextRequest) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const category = searchParams.get("category") as FlowiseNodeCategory | null;
		const name = searchParams.get("name");

		if (name) {
			// Return specific node
			const node = getFlowiseNodeByName(name);
			if (!node) {
				return NextResponse.json(
					{ error: `Node ${name} not found` },
					{ status: 404 }
				);
			}
			return NextResponse.json({ node });
		}

		if (category) {
			// Return nodes by category
			const nodes = getFlowiseNodesByCategory(category);
			return NextResponse.json({ nodes, category });
		}

		// Return all nodes
		const nodes = getAllFlowiseNodes();
		return NextResponse.json({ 
			nodes,
			total: nodes.length,
			categories: ["Sync", "Voice Agent", "API", "Event", "Data Transformation", "Control Flow"],
		});
	} catch (error: any) {
		console.error("[flowise-nodes] Error:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
