/**
 * MCP Tool Executor
 * 
 * Executes MCP tools by calling Verity API endpoints.
 * Extracted from src/app/api/mcp/chat/route.ts for reuse in workflows.
 */

import { loadApiCatalog, getEndpoint, type ApiCatalog } from "@/api-gateway/registry";
import { proxyToVerity } from "@/api-gateway/proxy";
import { getClerkSessionToken, clearCachedToken } from "@/auth/clerk-token-manager";

// Force localhost for local development - override env if needed
const VERITY_BASE_URL = process.env.NODE_ENV === "development"
	? (process.env.VERITY_BASE_URL?.includes("localhost") ? process.env.VERITY_BASE_URL : "http://localhost:3000")
	: (process.env.VERITY_BASE_URL || "https://verity.diversyfund.com");

// Cache catalog
let catalog: ApiCatalog | null = null;

async function initializeCatalog(): Promise<ApiCatalog | null> {
	if (catalog) return catalog;
	catalog = await loadApiCatalog();
	return catalog;
}

/**
 * Find endpoint from tool name
 * Maps tool names like "calls_agents_test_create" to endpoint paths and HTTP methods
 */
function findEndpointFromToolName(
	toolName: string,
	args?: Record<string, unknown>,
	catalogToUse?: ApiCatalog
): { endpoint: string; method: string } | null {
	const catalogRef = catalogToUse || catalog;
	if (!catalogRef) return null;

	const parts = toolName.split("_");
	if (parts.length < 3) return null;

	const domain = parts[0];
	const resource = parts[1];
	const action = parts[2];
	const methodSuffix = parts.length > 3 ? parts[3] : null;

	const methodMap: Record<string, string> = {
		list: "GET",
		get: "GET",
		create: "POST",
		update: "PUT",
		patch: "PATCH",
		delete: "DELETE",
		test: "POST", // test actions are POST requests
	};

	const inferredMethod = methodMap[action] || "GET";
	const method = methodSuffix ? methodSuffix.toUpperCase() : inferredMethod;

	// Collect all matching endpoints
	const matches: Array<{ endpoint: string; method: string; hasPathParams: boolean; pathParamMatches: boolean }> = [];

	for (const endpoint of catalogRef.endpoints) {
		let epDomain: string;
		let epResource: string;

		// Handle special cases like "/apisms" (no slash after api)
		if (endpoint.path.startsWith("/api") && !endpoint.path.startsWith("/api/")) {
			// Handle "/apisms", "/apicalls", etc.
			const afterApi = endpoint.path.slice(4); // Remove "/api"
			const parts = afterApi.split("/").filter((p) => p && !p.startsWith("{") && !p.startsWith("["));
			epDomain = parts[0]?.replace(/^api/, "") || afterApi.split("/")[0] || afterApi;
			epResource = parts[1] || parts[0] || epDomain;
		} else if (endpoint.path.startsWith("/api") && endpoint.path.length > 4) {
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

		// Match: domain matches AND (resource matches OR resource is same as domain for single-word endpoints)
		const domainMatches = epDomain === domain;
		const resourceMatches = epResource === resource || (epResource === epDomain && resource === domain);
		
		// For "test" action, also check if the path contains "/test"
		const actionMatches = action === "test" ? endpoint.path.includes("/test") : true;
		
		if (domainMatches && resourceMatches && actionMatches && endpoint.methods.includes(method)) {
			const hasPathParams = (endpoint.path.includes("[") || endpoint.path.includes("{")) && endpoint.parameters?.path;
			const pathParamMatches = hasPathParams && args && typeof args === "object" && 
				Object.keys(endpoint.parameters.path || {}).some(key => key in (args as Record<string, unknown>));
			
			let finalPath = endpoint.path;
			if (!finalPath.startsWith("/")) {
				finalPath = `/${finalPath}`;
			}
			matches.push({ endpoint: finalPath, method, hasPathParams: !!hasPathParams, pathParamMatches: !!pathParamMatches });
		}
	}

	// Prioritize: endpoints with "/test" in path (for test action) > endpoints without path params (for get/list) > endpoints with path params that match args
	if (matches.length > 0) {
		// For "test" action, ALWAYS prioritize endpoints that have "/test" in the path
		if (action === "test") {
			const withTestInPath = matches.filter(m => m.endpoint.includes("/test"));
			if (withTestInPath.length > 0) {
				const withTestAndPathParams = withTestInPath.filter(m => m.hasPathParams && m.pathParamMatches);
				if (withTestAndPathParams.length > 0) {
					return { endpoint: withTestAndPathParams[0].endpoint, method: withTestAndPathParams[0].method };
				}
				return { endpoint: withTestInPath[0].endpoint, method: withTestInPath[0].method };
			}
		}
		
		// For "get" or "list" actions, prioritize endpoints WITHOUT path params (list endpoints)
		if (action === "get" || action === "list") {
			const withoutPathParams = matches.filter(m => !m.hasPathParams);
			if (withoutPathParams.length > 0) {
				return { endpoint: withoutPathParams[0].endpoint, method: withoutPathParams[0].method };
			}
		}
		
		const withPathParams = matches.filter(m => m.hasPathParams && m.pathParamMatches);
		if (withPathParams.length > 0) {
			return { endpoint: withPathParams[0].endpoint, method: withPathParams[0].method };
		}
		const withoutPathParams = matches.filter(m => !m.hasPathParams);
		if (withoutPathParams.length > 0) {
			return { endpoint: withoutPathParams[0].endpoint, method: withoutPathParams[0].method };
		}
		// Fallback to first match
		return { endpoint: matches[0].endpoint, method: matches[0].method };
	}

	// Fallback: try to construct path, but handle special cases
	// For "sms_sms_create", the endpoint is "/apisms" not "/api/sms/sms"
	if (domain === "sms" && resource === "sms" && action === "create") {
		return {
			endpoint: "/apisms",
			method,
		};
	}
	
	return {
		endpoint: `/api/${domain}/${resource}`,
		method,
	};
}

export interface ToolExecutionResult {
	success: boolean;
	data?: unknown;
	error?: string;
}

/**
 * Execute an MCP tool by calling the corresponding Verity API endpoint
 * 
 * @param toolName - MCP tool name (e.g., "calls_agents_test_create")
 * @param args - Tool arguments
 * @param authToken - Authentication token (Clerk session token or API key)
 * @returns Tool execution result
 */
export async function executeTool(
	toolName: string,
	args: Record<string, unknown>,
	authToken: string
): Promise<ToolExecutionResult> {
	// Ensure catalog is loaded
	const catalogToUse = await initializeCatalog();
	if (!catalogToUse) {
		return { success: false, error: "API catalog not available" };
	}

	const endpointInfo = findEndpointFromToolName(toolName, args, catalogToUse);
	if (!endpointInfo) {
		return { success: false, error: `Could not resolve endpoint for tool: ${toolName}` };
	}

	const { endpoint: baseEndpoint, method } = endpointInfo;
	console.log(`[tool-executor] Tool: ${toolName}, Endpoint: ${baseEndpoint}, Method: ${method}, Args:`, JSON.stringify(args));
	const fullEndpoint = getEndpoint(catalogToUse, baseEndpoint, method);
	
	// Some endpoints require VERITY_API_KEY instead of Clerk tokens
	// Check if this is the SMS send-message endpoint
	const isSmsEndpoint = baseEndpoint === "/apisms" || baseEndpoint.includes("send-message");
	let finalAuthToken = authToken;
	if (isSmsEndpoint) {
		// Use VERITY_API_KEY for SMS endpoint (this endpoint uses API key auth, not Clerk)
		finalAuthToken = process.env.VERITY_API_KEY || authToken;
	}

	// Extract path parameters
	const params: Record<string, string> = {};
	if (fullEndpoint?.parameters?.path && args && typeof args === "object") {
		const argsObj = args as Record<string, unknown>;
		for (const [key] of Object.entries(fullEndpoint.parameters.path)) {
			// Check both direct args and nested in body
			if (key in argsObj && typeof argsObj[key] === "string") {
				params[key] = argsObj[key] as string;
			} else if (argsObj.body && typeof argsObj.body === "object") {
				const body = argsObj.body as Record<string, unknown>;
				if (key in body && typeof body[key] === "string") {
					params[key] = body[key] as string;
				}
			}
		}
	}
	
	// Special handling for test endpoint: if endpoint path contains {agentId} or [agentId], extract agentId from args
	if (baseEndpoint.includes("/test") && (baseEndpoint.includes("{agentId}") || baseEndpoint.includes("[agentId]"))) {
		if (args && typeof args === "object") {
			const argsObj = args as Record<string, unknown>;
			if (argsObj.agentId && typeof argsObj.agentId === "string" && !params.agentId) {
				params.agentId = argsObj.agentId;
			}
		}
	}

	// Extract query and body parameters
	const query: Record<string, string> = {};
	const bodyParams: Record<string, unknown> = {};

	if (args && typeof args === "object") {
		const argsObj = args as Record<string, unknown>;

		for (const [key, value] of Object.entries(argsObj)) {
			// Skip path parameters - they're already extracted
			if (params[key]) continue;

			if (method === "GET") {
				query[key] = String(value);
			} else {
				if (key === "body" && typeof value === "object") {
					// For SMS endpoint, flatten body object to top level
					if (baseEndpoint === "/apisms" || baseEndpoint.includes("send-message")) {
						Object.assign(bodyParams, value as Record<string, unknown>);
					} else if (baseEndpoint.includes("/calls/agents") || baseEndpoint.includes("/apicalls/agents")) {
						// Check if this is the test endpoint (for making calls)
						if (baseEndpoint.includes("/test")) {
							// For test endpoint, flatten body.to to top level
							const bodyObj = value as Record<string, unknown>;
							if (bodyObj.to) bodyParams.to = bodyObj.to;
							// Also allow direct "to" parameter (not wrapped in body)
							if (argsObj.to && !bodyParams.to) bodyParams.to = argsObj.to;
							// Don't include agentId in body - it's a path parameter
						} else {
							// For create/update endpoints, flatten body - name and systemPrompt are required at top level
							const bodyObj = value as Record<string, unknown>;
							if (bodyObj.name) bodyParams.name = bodyObj.name;
							if (bodyObj.systemPrompt) bodyParams.systemPrompt = bodyObj.systemPrompt;
							if (bodyObj.config) bodyParams.config = bodyObj.config;
							if (bodyObj.internalAgentId) bodyParams.internalAgentId = bodyObj.internalAgentId;
							if (bodyObj.elevenlabsAgentId) bodyParams.elevenlabsAgentId = bodyObj.elevenlabsAgentId;
							// Also allow direct name/systemPrompt in args (not wrapped in body)
							if (argsObj.name && !bodyParams.name) bodyParams.name = argsObj.name;
							if (argsObj.systemPrompt && !bodyParams.systemPrompt) bodyParams.systemPrompt = argsObj.systemPrompt;
						}
					} else if (baseEndpoint === "/apicomms/contacts" || baseEndpoint.includes("/comms/contacts")) {
						// For contacts endpoint, flatten body and map phone to phoneE164
						const bodyObj = value as Record<string, unknown>;
						if (bodyObj.phone) {
							bodyParams.phoneE164 = bodyObj.phone;
						}
						if (bodyObj.firstName !== undefined) bodyParams.firstName = bodyObj.firstName;
						if (bodyObj.lastName !== undefined) bodyParams.lastName = bodyObj.lastName;
						if (bodyObj.email !== undefined) bodyParams.email = bodyObj.email;
						if (bodyObj.canText !== undefined) bodyParams.canText = bodyObj.canText;
						if (bodyObj.canEmail !== undefined) bodyParams.canEmail = bodyObj.canEmail;
						if (bodyObj.status !== undefined) bodyParams.status = bodyObj.status;
						if (bodyObj.source !== undefined) bodyParams.source = bodyObj.source;
						if (bodyObj.tags !== undefined) bodyParams.tags = bodyObj.tags;
						// Also allow direct parameters (not wrapped in body) for PATCH operations
						if (method === "PATCH") {
							if (argsObj.tags && !bodyParams.tags) bodyParams.tags = argsObj.tags;
							if (argsObj.canText !== undefined && bodyParams.canText === undefined) bodyParams.canText = argsObj.canText;
						}
					} else {
						bodyParams.body = value;
					}
				} else if (key !== "body") {
					// For POST/PUT/PATCH, allow direct parameters (not wrapped in body)
					// This handles cases where name/systemPrompt are passed directly
					// But skip path parameters - they're already extracted
					if (method !== "GET" && !params[key]) {
						// For test endpoint, only allow "to" as a direct parameter
						if (baseEndpoint.includes("/test")) {
							if (key === "to") {
								bodyParams[key] = value;
							}
						} else {
							bodyParams[key] = value;
						}
					}
				}
			}
		}
	}
	
	// Log for debugging test tools
	if (toolName.includes("test")) {
		console.log(`[tool-executor] Test tool - endpoint: ${baseEndpoint}, method: ${method}, params:`, params, "bodyParams:", bodyParams);
	}

	// Proxy request to Verity API
	let response = await proxyToVerity(
		{
			endpoint: baseEndpoint,
			method: method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
			params: Object.keys(params).length > 0 ? params : undefined,
			query: Object.keys(query).length > 0 ? query : undefined,
			body: Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
			authToken: finalAuthToken,
		},
		VERITY_BASE_URL
	);

	// Handle 401 Unauthorized - token may have expired
	if (!response.success && response.meta.status === 401) {
		try {
			clearCachedToken();
			const newAuthToken = await getClerkSessionToken();

			response = await proxyToVerity(
				{
					endpoint: baseEndpoint,
					method: method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
					params: Object.keys(params).length > 0 ? params : undefined,
					query: Object.keys(query).length > 0 ? query : undefined,
					body: Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
					authToken: isSmsEndpoint ? finalAuthToken : newAuthToken,
				},
				VERITY_BASE_URL
			);
		} catch (refreshError: any) {
			return { success: false, error: `Authentication failed: ${refreshError.message}` };
		}
	}

	if (!response.success) {
		return {
			success: false,
			error: response.error?.message || "Request failed",
		};
	}

	return { success: true, data: response.data };
}
