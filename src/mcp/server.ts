#!/usr/bin/env bun
/**
 * DF-Middleware MCP Server
 * 
 * MCP server that exposes all Verity API endpoints as tools.
 * Tools are dynamically generated from the API catalog.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadApiCatalog, getEndpoint } from "../api-gateway/registry.js";
import { proxyToVerity } from "../api-gateway/proxy.js";
import { generateTools, MCPTool } from "./tools/generator.js";
import { getClerkSessionToken } from "../auth/clerk-token-manager.js";

const VERITY_BASE_URL = process.env.VERITY_BASE_URL || "http://localhost:3000";

// Initialize MCP server
const server = new Server(
	{
		name: "df-middleware-mcp-server",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	}
);

// Load API catalog and generate tools
let tools: MCPTool[] = [];
let catalog: Awaited<ReturnType<typeof loadApiCatalog>> = null;

/**
 * Initialize catalog and generate tools
 */
async function initializeCatalog() {
	console.error("[mcp-server] Loading API catalog...");
	catalog = await loadApiCatalog();
	
	if (!catalog) {
		console.error("[mcp-server] Failed to load API catalog");
		return;
	}

	console.error(`[mcp-server] Generating tools from ${catalog.statistics.totalEndpoints} endpoints...`);
	tools = generateTools(catalog);
	console.error(`[mcp-server] Generated ${tools.length} tools`);
}

/**
 * Find endpoint from tool name
 */
function findEndpointFromToolName(toolName: string): { endpoint: string; method: string } | null {
	if (!catalog) {
		return null;
	}

	// Tool names follow pattern: domain_resource_action or domain_resource_action_method
	const parts = toolName.split("_");
	if (parts.length < 3) {
		return null;
	}

	const domain = parts[0];
	const resource = parts[1];
	const action = parts[2];
	const methodSuffix = parts.length > 3 ? parts[3] : null;

	// Map action to HTTP method
	const methodMap: Record<string, string> = {
		list: "GET",
		get: "GET",
		create: "POST",
		update: "PUT",
		patch: "PATCH",
		delete: "DELETE",
	};

	const inferredMethod = methodMap[action] || "GET";
	const method = methodSuffix ? methodSuffix.toUpperCase() : inferredMethod;

		// Search catalog for matching endpoint
		for (const endpoint of catalog.endpoints) {
			// Extract domain and resource from endpoint path
			// Handle both "/api/comms/broadcasts" and "/apicalls/summarize-recent" formats
			let epDomain: string;
			let epResource: string;
			
			if (endpoint.path.startsWith("/api") && endpoint.path.length > 4) {
				const afterApi = endpoint.path.slice(4);
				const parts = afterApi.split("/").filter((p) => p);
				if (parts.length > 0 && parts[0].startsWith("api")) {
					epDomain = parts[0].replace(/^api/, "");
					epResource = parts[1] || parts[0];
				} else {
					epDomain = parts[0] || "root";
					epResource = parts[1] || "root";
				}
			} else {
				const parts = endpoint.path.split("/").filter((p) => p && p !== "api");
				epDomain = parts[0] || "root";
				epResource = parts[1] || "root";
			}
			
			if (epDomain === domain && epResource === resource && endpoint.methods.includes(method)) {
				// Ensure path starts with /
				let finalPath = endpoint.path;
				if (!finalPath.startsWith("/")) {
					finalPath = `/${finalPath}`;
				}
				return {
					endpoint: finalPath,
					method,
				};
			}
		}

	// Fallback: construct path from tool name
	return {
		endpoint: `/api${domain}/${resource}`,
		method,
	};
}

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
	if (tools.length === 0) {
		await initializeCatalog();
	}

	return { tools };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	try {
		// Ensure catalog is loaded
		if (!catalog) {
			await initializeCatalog();
		}

		if (!catalog) {
			throw new Error("Failed to load API catalog");
		}

		// Find the tool definition
		const tool = tools.find((t) => t.name === name);
		if (!tool) {
			throw new Error(`Unknown tool: ${name}`);
		}

		// Find endpoint from tool name
		const endpointInfo = findEndpointFromToolName(name);
		if (!endpointInfo) {
			throw new Error(`Could not resolve endpoint for tool: ${name}`);
		}

		const { endpoint: baseEndpoint, method } = endpointInfo;

		// Get full endpoint info from catalog
		const fullEndpoint = getEndpoint(catalog, baseEndpoint, method);
		
		// Extract path parameters
		const params: Record<string, string> = {};
		if (fullEndpoint?.parameters?.path && args && typeof args === "object") {
			const argsObj = args as Record<string, unknown>;
			for (const [key] of Object.entries(fullEndpoint.parameters.path)) {
				if (key in argsObj && typeof argsObj[key] === "string") {
					params[key] = argsObj[key] as string;
				}
			}
		}

		// Extract query and body parameters
		const query: Record<string, string> = {};
		const body: Record<string, unknown> = {};
		
		if (args && typeof args === "object") {
			const argsObj = args as Record<string, unknown>;
			
			for (const [key, value] of Object.entries(argsObj)) {
				// Skip path parameters
				if (params[key]) continue;
				
				// For GET requests, put everything in query
				if (method === "GET") {
					query[key] = String(value);
				} else {
					// For POST/PUT/PATCH, check if it's a body object or individual field
					if (key === "body" && typeof value === "object") {
						Object.assign(body, value as Record<string, unknown>);
					} else {
						body[key] = value;
					}
				}
			}
		}

		// Get Clerk session token for authentication
		let authToken: string;
		try {
			authToken = await getClerkSessionToken();
		} catch (error: any) {
			throw new Error(`Failed to get Clerk authentication token: ${error.message}`);
		}

		// Proxy request to Verity API
		let response = await proxyToVerity(
			{
				endpoint: baseEndpoint,
				method: method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
				params: Object.keys(params).length > 0 ? params : undefined,
				query: Object.keys(query).length > 0 ? query : undefined,
				body: Object.keys(body).length > 0 ? body : undefined,
				authToken, // Use Clerk JWT token for authentication
			},
			VERITY_BASE_URL
		);

		// Handle 401 Unauthorized - token may have expired, try refreshing
		if (!response.success && response.meta.status === 401) {
			console.error("[mcp-server] Received 401, refreshing Clerk token and retrying...");
			try {
				// Clear cache and get fresh token
				const { clearCachedToken } = await import("../auth/clerk-token-manager.js");
				clearCachedToken();
				authToken = await getClerkSessionToken();
				
				// Retry the request with new token
				response = await proxyToVerity(
					{
						endpoint: baseEndpoint,
						method: method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
						params: Object.keys(params).length > 0 ? params : undefined,
						query: Object.keys(query).length > 0 ? query : undefined,
						body: Object.keys(body).length > 0 ? body : undefined,
						authToken,
					},
					VERITY_BASE_URL
				);
			} catch (refreshError: any) {
				throw new Error(`Authentication failed after token refresh: ${refreshError.message}`);
			}
		}

		if (!response.success) {
			throw new Error(response.error?.message || "Request failed");
		}

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(response.data, null, 2),
				},
			],
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
});

/**
 * Start MCP server
 */
async function main() {
	await initializeCatalog();
	
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("DF-Middleware MCP server v1.0.0 running on stdio");
}

main().catch(console.error);
