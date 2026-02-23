/**
 * Enhanced tool descriptions with examples and exact parameter mappings
 * This ensures the AI knows exactly how to call each endpoint correctly
 * 
 * For all 300+ tools, descriptions are auto-generated from the API catalog.
 * Custom descriptions can override the auto-generated ones for specific tools.
 */

import type { EndpointInfo } from "../../api-gateway/registry.js";
import { extractDomain, extractResource, inferAction, generateToolName } from "@/mcp/tools/generator";

export interface ToolDescription {
	toolNamePattern: string | RegExp;
	description: string;
	exampleArgs: Record<string, unknown>;
	parameterMapping: {
		[key: string]: {
			apiField: string;
			required: boolean;
			type: string;
			description: string;
		};
	};
	commonMistakes?: string[];
}

export const ENHANCED_DESCRIPTIONS: ToolDescription[] = [
	{
		toolNamePattern: /^calls_agents_create$/,
		description: `Create a new ElevenLabs AI calling agent. This creates both an internal agent record and syncs it to ElevenLabs.

REQUIRED PARAMETERS:
- name (string): The name of the agent (e.g., "Danny Chief of Staff")
- systemPrompt (string): The system prompt describing the agent's role and behavior

OPTIONAL PARAMETERS:
- config (object): Additional configuration with modelJson, variablesJson, etc.

EXAMPLE:
{
  "name": "Danny Chief of Staff",
  "systemPrompt": "You are a professional chief of staff assistant. Your role is to..."
}`,
		exampleArgs: {
			name: "Danny Chief of Staff",
			systemPrompt: "You are a professional chief of staff assistant. Your role is to handle scheduling, communications, and administrative tasks professionally and efficiently.",
		},
		parameterMapping: {
			name: {
				apiField: "name",
				required: true,
				type: "string",
				description: "Agent name",
			},
			systemPrompt: {
				apiField: "systemPrompt",
				required: true,
				type: "string",
				description: "System prompt for the agent",
			},
			config: {
				apiField: "config",
				required: false,
				type: "object",
				description: "Additional configuration",
			},
		},
		commonMistakes: [
			"Wrapping name and systemPrompt in a 'body' object - they should be at the top level",
			"Missing required name or systemPrompt parameters",
		],
	},
	{
		toolNamePattern: /^calls_agents_.*_test_create$/,
		description: `Initiate an AI phone call using an ElevenLabs agent. This makes an actual phone call to a specified number.

REQUIRED PARAMETERS:
- agentId (path parameter): The agent ID from creating an agent (extracted from tool name)
- body.to (string): Phone number in E.164 format (e.g., "+19492459055")

OPTIONAL PARAMETERS:
- body.from (string): Caller ID phone number

EXAMPLE:
{
  "agentId": "agent-123",  // This comes from the path, not the body
  "body": {
    "to": "+19492459055"
  }
}`,
		exampleArgs: {
			agentId: "agent-123",
			body: {
				to: "+19492459055",
			},
		},
		parameterMapping: {
			agentId: {
				apiField: "agentId",
				required: true,
				type: "string (path)",
				description: "Agent ID (extracted from tool name path)",
			},
			"body.to": {
				apiField: "to",
				required: true,
				type: "string",
				description: "Phone number in E.164 format",
			},
			"body.from": {
				apiField: "from",
				required: false,
				type: "string",
				description: "Caller ID phone number",
			},
		},
		commonMistakes: [
			"Not providing the 'to' phone number",
			"Using wrong phone number format (must be E.164 like +19492459055)",
			"Trying to use calls_agents_create to make calls (that's for creating agents, not calling)",
		],
	},
	{
		toolNamePattern: /^comms_contacts_get$/,
		description: `Get a list of contacts with optional filtering and search.

OPTIONAL PARAMETERS:
- query (string): Search term for name, email, or phone (e.g., "jared.lutz@diversyfund.com")
- page (number): Page number for pagination (default: 1)
- limit (number): Results per page (default: 50, max: 100)
- status (string): Filter by status
- source (string): Filter by source

EXAMPLE - Search by email:
{
  "query": "jared.lutz@diversyfund.com"
}

EXAMPLE - List contacts:
{
  "page": 1,
  "limit": 50
}`,
		exampleArgs: {
			query: "jared.lutz@diversyfund.com",
		},
		parameterMapping: {
			query: {
				apiField: "query",
				required: false,
				type: "string",
				description: "Search term for name, email, or phone",
			},
			page: {
				apiField: "page",
				required: false,
				type: "number",
				description: "Page number",
			},
			limit: {
				apiField: "limit",
				required: false,
				type: "number",
				description: "Results per page",
			},
		},
	},
	{
		toolNamePattern: /^comms_contacts_create$/,
		description: `Create a new contact.

REQUIRED PARAMETERS:
- firstName (string): First name
- lastName (string): Last name
- phoneE164 (string): Phone number in E.164 format (e.g., "+19492459055")
  OR phone (string): Will be mapped to phoneE164 automatically

OPTIONAL PARAMETERS:
- email (string): Email address
- canText (boolean): Whether contact can receive SMS
- canEmail (boolean): Whether contact can receive email
- tags (array): Array of tag strings
- status (string): Contact status
- source (string): Contact source

EXAMPLE:
{
  "firstName": "Jared",
  "lastName": "Test",
  "phone": "+19492451555",
  "email": "jared@example.com",
  "tags": ["test"]
}`,
		exampleArgs: {
			firstName: "Jared",
			lastName: "Test",
			phone: "+19492451555",
		},
		parameterMapping: {
			firstName: {
				apiField: "firstName",
				required: true,
				type: "string",
				description: "First name",
			},
			lastName: {
				apiField: "lastName",
				required: true,
				type: "string",
				description: "Last name",
			},
			phone: {
				apiField: "phoneE164",
				required: true,
				type: "string",
				description: "Phone number (will be mapped to phoneE164)",
			},
			email: {
				apiField: "email",
				required: false,
				type: "string",
				description: "Email address",
			},
			tags: {
				apiField: "tags",
				required: false,
				type: "array",
				description: "Array of tag strings",
			},
		},
	},
	{
		toolNamePattern: /^comms_contacts_patch$/,
		description: `Update an existing contact by ID.

REQUIRED PARAMETERS:
- id (string, path): Contact ID

OPTIONAL PARAMETERS (in body object):
- tags (array): Array of tag strings (replaces existing tags)
- canText (boolean): Enable/disable SMS
- canEmail (boolean): Enable/disable email
- firstName, lastName, email, phoneE164, status, source

EXAMPLE - Add tag:
{
  "id": "contact-uuid-here",
  "body": {
    "tags": ["test-2"]
  }
}

EXAMPLE - Enable SMS:
{
  "id": "contact-uuid-here",
  "body": {
    "canText": true
  }
}`,
		exampleArgs: {
			id: "contact-uuid-here",
			body: {
				tags: ["test-2"],
			},
		},
		parameterMapping: {
			id: {
				apiField: "id",
				required: true,
				type: "string (path)",
				description: "Contact ID",
			},
			"body.tags": {
				apiField: "tags",
				required: false,
				type: "array",
				description: "Array of tag strings",
			},
			"body.canText": {
				apiField: "canText",
				required: false,
				type: "boolean",
				description: "Enable SMS",
			},
		},
		commonMistakes: [
			"Not providing the contact id",
			"Not wrapping update fields in a 'body' object",
			"Using PUT instead of PATCH",
		],
	},
	{
		toolNamePattern: /^sms_sms_create$/,
		description: `Send an SMS/text message to a phone number.

REQUIRED PARAMETERS:
- body.to (string): Phone number in E.164 format (e.g., "+19492459055")
- body.body (string): Message text

EXAMPLE:
{
  "body": {
    "to": "+19492459055",
    "body": "Hello, this is a test message"
  }
}`,
		exampleArgs: {
			body: {
				to: "+19492459055",
				body: "Hello, this is a test message",
			},
		},
		parameterMapping: {
			"body.to": {
				apiField: "to",
				required: true,
				type: "string",
				description: "Phone number in E.164 format",
			},
			"body.body": {
				apiField: "body",
				required: true,
				type: "string",
				description: "Message text",
			},
		},
		commonMistakes: [
			"Not wrapping parameters in a 'body' object",
			"Using wrong phone number format",
			"Missing 'to' or 'body' parameter",
		],
	},
];

/**
 * Auto-generate enhanced description from endpoint info
 */
export function generateDescriptionFromEndpoint(
	toolName: string,
	endpoint: EndpointInfo,
	method: string
): ToolDescription {
	const parts = toolName.split("_");
	const action = parts[parts.length - 1] || "get";
	
	// Build parameter mapping
	const parameterMapping: ToolDescription["parameterMapping"] = {};
	const exampleArgs: Record<string, unknown> = {};
	
	// Path parameters
	if (endpoint.parameters?.path) {
		for (const [key, type] of Object.entries(endpoint.parameters.path)) {
			parameterMapping[key] = {
				apiField: key,
				required: true,
				type: type || "string",
				description: `${key} parameter (path)`,
			};
			exampleArgs[key] = `example-${key}`;
		}
	}
	
	// Query parameters
	if (endpoint.parameters?.query) {
		for (const [key, type] of Object.entries(endpoint.parameters.query)) {
			parameterMapping[key] = {
				apiField: key,
				required: false,
				type: type || "string",
				description: `Query parameter: ${key}`,
			};
			exampleArgs[key] = `example-${key}`;
		}
	}
	
	// Body parameters (for POST/PUT/PATCH)
	if (["POST", "PUT", "PATCH"].includes(method)) {
		if (endpoint.parameters?.body && typeof endpoint.parameters.body === "object") {
			const bodyParams = endpoint.parameters.body as Record<string, unknown>;
			for (const [key, value] of Object.entries(bodyParams)) {
				const type = typeof value === "string" ? value : "object";
				parameterMapping[`body.${key}`] = {
					apiField: key,
					required: false,
					type: type,
					description: `Body parameter: ${key}`,
				};
				if (!exampleArgs.body) exampleArgs.body = {};
				(exampleArgs.body as Record<string, unknown>)[key] = type === "string" ? `example-${key}` : {};
			}
		} else {
			// Generic body object
			parameterMapping.body = {
				apiField: "body",
				required: method === "POST",
				type: "object",
				description: "Request body",
			};
			exampleArgs.body = {};
		}
	}
	
	// Generate description
	let description = endpoint.description || `${method} ${endpoint.path}`;
	
	if (Object.keys(parameterMapping).length > 0) {
		const required = Object.entries(parameterMapping)
			.filter(([_, info]) => info.required)
			.map(([key]) => key);
		const optional = Object.entries(parameterMapping)
			.filter(([_, info]) => !info.required)
			.map(([key]) => key);
		
		description += "\n\n";
		if (required.length > 0) {
			description += `REQUIRED PARAMETERS:\n${required.map(p => `- ${p}`).join("\n")}\n\n`;
		}
		if (optional.length > 0) {
			description += `OPTIONAL PARAMETERS:\n${optional.map(p => `- ${p}`).join("\n")}\n\n`;
		}
		description += `EXAMPLE:\n${JSON.stringify(exampleArgs, null, 2)}`;
	}
	
	return {
		toolNamePattern: toolName,
		description,
		exampleArgs,
		parameterMapping,
	};
}

/**
 * Get enhanced description for a tool
 * Falls back to auto-generated description if no custom one exists
 */
export function getEnhancedDescription(
	toolName: string,
	endpoint?: EndpointInfo,
	method?: string
): ToolDescription | null {
	// First check custom descriptions
	for (const desc of ENHANCED_DESCRIPTIONS) {
		if (typeof desc.toolNamePattern === "string") {
			if (toolName === desc.toolNamePattern) {
				return desc;
			}
		} else if (desc.toolNamePattern.test(toolName)) {
			return desc;
		}
	}
	
	// Fall back to auto-generated description if endpoint info is provided
	if (endpoint && method) {
		return generateDescriptionFromEndpoint(toolName, endpoint, method);
	}
	
	return null;
}

/**
 * Generate a comprehensive tool directory/map
 * Now includes all tools with auto-generated descriptions
 */
export function generateToolDirectory(
	tools: Array<{ name: string; description: string }>,
	catalog?: { endpoints: EndpointInfo[] }
): string {
	const directory: string[] = [
		"# Verity API Tool Directory",
		"",
		"This directory contains all available tools with exact usage instructions.",
		"",
		"## Tool Categories",
		"",
	];

	// Group tools by domain
	const byDomain: Record<string, Array<{ name: string; description: string }>> = {};
	
	for (const tool of tools) {
		const parts = tool.name.split("_");
		const domain = parts[0] || "other";
		if (!byDomain[domain]) {
			byDomain[domain] = [];
		}
		byDomain[domain].push(tool);
	}

	// Create a map of tool names to endpoints for lookup
	// Use the exact same tool name generation functions from generator.ts
	const toolToEndpoint = new Map<string, { endpoint: EndpointInfo; method: string }>();
	const toolNamesSeen = new Set<string>();
	
	if (catalog) {
		for (const endpoint of catalog.endpoints) {
			for (const method of endpoint.methods) {
				// Use the exact same generateToolName function to ensure perfect matching
				const toolName = generateToolName(endpoint, method);
				
				// Handle duplicates the same way as generator.ts
				if (toolNamesSeen.has(toolName)) {
					const uniqueName = `${toolName}_${method.toLowerCase()}`;
					if (!toolNamesSeen.has(uniqueName)) {
						toolNamesSeen.add(uniqueName);
						toolToEndpoint.set(uniqueName, { endpoint, method });
					}
				} else {
					toolNamesSeen.add(toolName);
					toolToEndpoint.set(toolName, { endpoint, method });
				}
			}
		}
	}

	for (const [domain, domainTools] of Object.entries(byDomain)) {
		directory.push(`### ${domain.toUpperCase()} Tools (${domainTools.length} tools)`);
		directory.push("");
		
		for (const tool of domainTools) {
			// Try to get endpoint info for auto-generation
			const endpointInfo = toolToEndpoint.get(tool.name);
			const enhanced = endpointInfo 
				? getEnhancedDescription(tool.name, endpointInfo.endpoint, endpointInfo.method)
				: getEnhancedDescription(tool.name);
			
			directory.push(`#### ${tool.name}`);
			directory.push("");
			directory.push(enhanced?.description || tool.description);
			directory.push("");
			
			if (enhanced?.parameterMapping && Object.keys(enhanced.parameterMapping).length > 0) {
				directory.push("**Parameter Mapping:**");
				for (const [key, info] of Object.entries(enhanced.parameterMapping)) {
					directory.push(`- ${key} (${info.type}${info.required ? ", required" : ", optional"}): ${info.description} → API field: ${info.apiField}`);
				}
				directory.push("");
			}
			
			if (enhanced?.exampleArgs && Object.keys(enhanced.exampleArgs).length > 0) {
				directory.push("**Example:**");
				directory.push("```json");
				directory.push(JSON.stringify(enhanced.exampleArgs, null, 2));
				directory.push("```");
				directory.push("");
			}
			
			if (enhanced?.commonMistakes && enhanced.commonMistakes.length > 0) {
				directory.push("**Common Mistakes to Avoid:**");
				for (const mistake of enhanced.commonMistakes) {
					directory.push(`- ${mistake}`);
				}
				directory.push("");
			}
		}
	}

	return directory.join("\n");
}
