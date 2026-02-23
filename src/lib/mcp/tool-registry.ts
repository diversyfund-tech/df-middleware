/**
 * MCP Tool Registry
 * 
 * Provides access to available MCP tools and their descriptions
 * for use in workflow prompts and tool selection.
 */

import { loadApiCatalog } from "@/api-gateway/registry";
import { generateTools, type MCPTool } from "@/mcp/tools/generator";
import { getEnhancedDescription } from "@/mcp/tools/enhanced-descriptions";

let cachedTools: MCPTool[] | null = null;
let cachedCatalog: Awaited<ReturnType<typeof loadApiCatalog>> | null = null;

/**
 * Load and cache tools from API catalog
 */
export async function loadTools(): Promise<MCPTool[]> {
	if (cachedTools) return cachedTools;

	const catalog = await loadApiCatalog();
	if (!catalog) {
		throw new Error("Failed to load API catalog");
	}

	cachedCatalog = catalog;
	cachedTools = generateTools(catalog);
	return cachedTools;
}

/**
 * Get all available tools
 */
export async function getAllTools(): Promise<MCPTool[]> {
	return loadTools();
}

/**
 * Get tools filtered by workflow type
 * 
 * @param workflowType - Workflow type to filter by ('sales' | 'support' | 'appointment' | 'custom')
 */
export async function getToolsForWorkflow(workflowType: string): Promise<MCPTool[]> {
	const tools = await loadTools();
	
	// Filter tools based on workflow type requirements
	// Sales workflow needs: contacts, appointments, SMS, conversations
	// Support workflow needs: contacts, conversations, tickets (if available)
	// Appointment workflow needs: calendars, appointments, SMS
	
	const workflowToolPatterns: Record<string, string[]> = {
		sales: [
			"contact",
			"appointment",
			"sms",
			"conversation",
			"calendar",
		],
		support: [
			"contact",
			"conversation",
			"ticket",
			"sms",
		],
		appointment: [
			"calendar",
			"appointment",
			"sms",
			"contact",
		],
		custom: [], // All tools for custom workflows
	};

	const patterns = workflowToolPatterns[workflowType] || [];
	
	if (workflowType === "custom" || patterns.length === 0) {
		return tools; // Return all tools
	}

	return tools.filter(tool => {
		const toolName = tool.name.toLowerCase();
		return patterns.some(pattern => toolName.includes(pattern));
	});
}

/**
 * Get tool by name
 */
export async function getTool(toolName: string): Promise<MCPTool | null> {
	const tools = await loadTools();
	return tools.find(t => t.name === toolName) || null;
}

/**
 * Get tool description with enhanced details
 */
export async function getToolDescription(toolName: string): Promise<string> {
	const tool = await getTool(toolName);
	if (!tool) {
		return `Tool ${toolName} not found`;
	}

	const enhanced = getEnhancedDescription(toolName);
	if (enhanced) {
		return enhanced.description;
	}

	return tool.description;
}

/**
 * Get all tool descriptions formatted for prompts
 */
export async function getToolDescriptionsForPrompt(workflowType?: string): Promise<string> {
	const tools = workflowType 
		? await getToolsForWorkflow(workflowType)
		: await getAllTools();

	const descriptions = await Promise.all(
		tools.map(async (tool) => {
			const enhanced = getEnhancedDescription(tool.name);
			const description = enhanced?.description || tool.description;
			return `- ${tool.name}: ${description}`;
		})
	);

	return descriptions.join("\n");
}

/**
 * Search tools by keyword
 */
export async function searchTools(keyword: string): Promise<MCPTool[]> {
	const tools = await loadTools();
	const lowerKeyword = keyword.toLowerCase();
	
	return tools.filter(tool => 
		tool.name.toLowerCase().includes(lowerKeyword) ||
		tool.description.toLowerCase().includes(lowerKeyword)
	);
}
