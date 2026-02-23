/**
 * Tool Generator
 * 
 * Generates MCP tools from API catalog.
 * Converts Verity API endpoints into MCP tool definitions.
 */

import { ApiCatalog, EndpointInfo } from "../../api-gateway/registry.js";

export interface MCPTool {
	name: string;
	description: string;
	inputSchema: {
		type: string;
		properties: Record<string, {
			type: string;
			description?: string;
			items?: { type: string };
		}>;
		required?: string[];
	};
}

/**
 * Extract domain from path
 * Handles both "/api/comms/broadcasts" and "/apicalls/summarize-recent" formats
 * e.g., "/api/comms/broadcasts" -> "comms"
 * e.g., "/apicalls/summarize-recent" -> "calls"
 */
export function extractDomain(path: string): string {
	// Handle "/api{domain}" format (e.g., "/apicalls" -> "calls")
	if (path.startsWith("/api") && path.length > 4) {
		const afterApi = path.slice(4); // Remove "/api"
		const parts = afterApi.split("/").filter((p) => p);
		// If path is "/apicalls/...", extract "calls" from "apicalls"
		if (parts.length > 0 && parts[0].startsWith("api")) {
			return parts[0].replace(/^api/, "");
		}
		return parts[0] || "root";
	}
	
	// Handle "/api/{domain}" format
	const parts = path.split("/").filter((p) => p && p !== "api");
	return parts[0] || "root";
}

/**
 * Extract resource from path
 * Handles both "/api/comms/broadcasts" and "/apicalls/summarize-recent" formats
 * e.g., "/api/comms/broadcasts" -> "broadcasts"
 * e.g., "/apicalls/summarize-recent" -> "summarize-recent"
 */
export function extractResource(path: string): string {
	// Handle "/api{domain}/{resource}" format
	if (path.startsWith("/api") && path.length > 4) {
		const afterApi = path.slice(4); // Remove "/api"
		const parts = afterApi.split("/").filter((p) => p);
		// If first part is like "apicalls", skip it and get next part
		if (parts.length > 0 && parts[0].startsWith("api")) {
			return parts[1] || parts[0] || "root";
		}
		return parts[1] || parts[0] || "root";
	}
	
	// Handle "/api/{domain}/{resource}" format
	const parts = path.split("/").filter((p) => p && p !== "api");
	return parts[1] || "root";
}

/**
 * Infer action from HTTP method and path
 */
export function inferAction(method: string, path: string): string {
	// Check for common patterns
	if (path.includes("/test")) {
		return "test";
	}
	if (path.includes("/list") || path.includes("/all")) {
		return "list";
	}
	if (path.includes("/create") || path.includes("/new")) {
		return "create";
	}
	if (path.includes("/update") || path.includes("/edit")) {
		return "update";
	}
	if (path.includes("/delete") || path.includes("/remove")) {
		return "delete";
	}

	// Infer from HTTP method
	const methodMap: Record<string, string> = {
		GET: "get",
		POST: "create",
		PUT: "update",
		PATCH: "patch",
		DELETE: "delete",
	};

	return methodMap[method] || "get";
}

/**
 * Generate tool name from endpoint
 * Pattern: domain_resource_action
 */
export function generateToolName(endpoint: EndpointInfo, method: string): string {
	const domain = extractDomain(endpoint.path);
	const resource = extractResource(endpoint.path);
	const action = inferAction(method, endpoint.path);

	return `${domain}_${resource}_${action}`;
}

/**
 * Generate tool description from endpoint
 */
function generateDescription(endpoint: EndpointInfo, method: string): string {
	if (endpoint.description) {
		return endpoint.description;
	}

	const domain = extractDomain(endpoint.path);
	const resource = extractResource(endpoint.path);
	const action = inferAction(method, endpoint.path);

	return `${method} ${endpoint.path} - ${action} ${resource} in ${domain}`;
}

/**
 * Convert endpoint parameters to JSON Schema properties
 */
function generateProperties(endpoint: EndpointInfo): Record<string, {
	type: string;
	description?: string;
	items?: { type: string };
}> {
	const properties: Record<string, {
		type: string;
		description?: string;
		items?: { type: string };
	}> = {};

	// Add path parameters
	if (endpoint.parameters?.path) {
		for (const [key, type] of Object.entries(endpoint.parameters.path)) {
			properties[key] = {
				type: type === "string" ? "string" : "string", // Default to string
				description: `${key} parameter`,
			};
		}
	}

	// Add query parameters
	if (endpoint.parameters?.query) {
		for (const [key, type] of Object.entries(endpoint.parameters.query)) {
			properties[key] = {
				type: type === "string" ? "string" : "string",
				description: `Query parameter: ${key}`,
			};
		}
	}

	// For POST/PUT/PATCH, add body properties
	if (["POST", "PUT", "PATCH"].includes(endpoint.methods[0])) {
		// This is simplified - actual implementation should parse Zod schemas
		properties.body = {
			type: "object",
			description: "Request body",
		};
	}

	return properties;
}

/**
 * Generate required fields list
 */
function generateRequired(endpoint: EndpointInfo): string[] {
	const required: string[] = [];

	// Path parameters are always required
	if (endpoint.parameters?.path) {
		required.push(...Object.keys(endpoint.parameters.path));
	}

	return required;
}

/**
 * Generate MCP tools from API catalog
 */
export function generateTools(catalog: ApiCatalog): MCPTool[] {
	const tools: MCPTool[] = [];
	const toolNames = new Set<string>();

	for (const endpoint of catalog.endpoints) {
		for (const method of endpoint.methods) {
			const toolName = generateToolName(endpoint, method);

			// Ensure unique tool names
			if (toolNames.has(toolName)) {
				// Append method if duplicate
				const uniqueName = `${toolName}_${method.toLowerCase()}`;
				if (!toolNames.has(uniqueName)) {
					toolNames.add(uniqueName);
					tools.push({
						name: uniqueName,
						description: generateDescription(endpoint, method),
						inputSchema: {
							type: "object",
							properties: generateProperties(endpoint),
							required: generateRequired(endpoint),
						},
					});
				}
			} else {
				toolNames.add(toolName);
				tools.push({
					name: toolName,
					description: generateDescription(endpoint, method),
					inputSchema: {
						type: "object",
						properties: generateProperties(endpoint),
						required: generateRequired(endpoint),
					},
				});
			}
		}
	}

	return tools;
}
