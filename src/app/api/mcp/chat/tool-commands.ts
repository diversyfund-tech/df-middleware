/**
 * Tool Commands Reference
 * 
 * This file contains structured command definitions for all available Verity API tools.
 * Used by the AI to understand what tools are available and how to use them.
 */

export interface ToolCommand {
	name: string;
	description: string;
	usage: string;
	example: string;
	parameters: {
		name: string;
		type: string;
		required: boolean;
		description: string;
	}[];
	category: string;
}

export const TOOL_COMMANDS: ToolCommand[] = [
	// SMS/Messaging Commands
	{
		name: "sms_sms_create",
		description: "Send an SMS/text message to a phone number",
		usage: "sms_sms_create with body containing 'to' (phone number) and 'body' (message text)",
		example: '{"body": {"to": "+19492459055", "body": "Hello, I will be late to the meeting"}}',
		parameters: [
			{ name: "body", type: "object", required: true, description: "Request body object" },
			{ name: "body.to", type: "string", required: true, description: "Phone number in E.164 format (e.g., +19492459055)" },
			{ name: "body.body", type: "string", required: true, description: "The message text to send" },
		],
		category: "messaging",
	},
	
	// Phone Call Commands
	{
		name: "calls_agents_create",
		description: "Initiate an AI phone call using an ElevenLabs agent",
		usage: "calls_agents_create with agentId and body containing 'to' (phone number)",
		example: '{"agentId": "agent_3901kffpqtbge0ev6cve7fgcvbkg", "body": {"to": "+19492459055"}}',
		parameters: [
			{ name: "agentId", type: "string", required: true, description: "ElevenLabs agent ID (e.g., agent_3901kffpqtbge0ev6cve7fgcvbkg)" },
			{ name: "body", type: "object", required: true, description: "Request body object" },
			{ name: "body.to", type: "string", required: true, description: "Phone number in E.164 format to call" },
		],
		category: "calls",
	},
	
	// Contact Commands
	{
		name: "contacts_create",
		description: "Create a new contact in the CRM system. Use this when the user wants to add a contact, create a contact, or save contact information. This is the PRIMARY tool for contact creation.",
		usage: "contacts_create with body containing contact information. Map phone to phoneE164 automatically.",
		example: 'User: "Create a contact named John Doe with phone +1234567890 and email john@example.com"\nAI: Use contacts_create with {"body": {"firstName": "John", "lastName": "Doe", "phone": "+1234567890", "email": "john@example.com"}}',
		parameters: [
			{ name: "body", type: "object", required: true, description: "Contact information object" },
			{ name: "body.firstName", type: "string", required: false, description: "First name of the contact" },
			{ name: "body.lastName", type: "string", required: false, description: "Last name of the contact" },
			{ name: "body.phone", type: "string", required: false, description: "Phone number in E.164 format (e.g., +1234567890). Will be automatically mapped to phoneE164." },
			{ name: "body.email", type: "string", required: false, description: "Email address of the contact" },
		],
		category: "contacts",
	},
	
	{
		name: "contacts_get",
		description: "Get contact information by contact ID",
		usage: "contacts_get with contactId parameter",
		example: '{"contactId": "contact_123"}',
		parameters: [
			{ name: "contactId", type: "string", required: true, description: "Contact ID to retrieve" },
		],
		category: "contacts",
	},
	
	// Conversation Commands
	{
		name: "conversations_search",
		description: "Search for conversations",
		usage: "conversations_search with query parameters",
		example: '{"query": {"contactId": "contact_123", "limit": 20}}',
		parameters: [
			{ name: "query", type: "object", required: false, description: "Search query parameters" },
			{ name: "query.contactId", type: "string", required: false, description: "Filter by contact ID" },
			{ name: "query.limit", type: "number", required: false, description: "Number of results to return" },
		],
		category: "conversations",
	},
	
	// Agent Commands
	{
		name: "calls_agents_get",
		description: "Get agent information or list of agents",
		usage: "calls_agents_get to retrieve agent details",
		example: '{}',
		parameters: [],
		category: "agents",
	},
	
	// Broadcast Commands
	{
		name: "comms_broadcasts_create",
		description: "Create a broadcast message",
		usage: "comms_broadcasts_create with body containing broadcast details",
		example: '{"body": {"message": "Hello everyone", "recipients": ["+19492459055"]}}',
		parameters: [
			{ name: "body", type: "object", required: true, description: "Broadcast details" },
			{ name: "body.message", type: "string", required: true, description: "Message to broadcast" },
			{ name: "body.recipients", type: "array", required: true, description: "Array of phone numbers" },
		],
		category: "broadcasts",
	},
];

/**
 * Generate a formatted command reference string for the AI
 */
export function generateToolCommandsReference(availableTools: string[]): string {
	const relevantCommands = TOOL_COMMANDS.filter(cmd => 
		availableTools.some(tool => tool.toLowerCase().includes(cmd.name.toLowerCase().replace(/_/g, "")))
	);
	
	if (relevantCommands.length === 0) {
		return "No specific command references available for the current tools.";
	}
	
	let reference = "AVAILABLE TOOL COMMANDS:\n\n";
	
	// Group by category
	const byCategory: Record<string, ToolCommand[]> = {};
	for (const cmd of relevantCommands) {
		if (!byCategory[cmd.category]) {
			byCategory[cmd.category] = [];
		}
		byCategory[cmd.category].push(cmd);
	}
	
	for (const [category, commands] of Object.entries(byCategory)) {
		reference += `## ${category.toUpperCase()}\n\n`;
		for (const cmd of commands) {
			reference += `**${cmd.name}**: ${cmd.description}\n`;
			reference += `- Usage: ${cmd.usage}\n`;
			reference += `- Example: ${cmd.example}\n`;
			if (cmd.parameters.length > 0) {
				reference += `- Parameters:\n`;
				for (const param of cmd.parameters) {
					reference += `  - ${param.name} (${param.type}${param.required ? ", required" : ", optional"}): ${param.description}\n`;
				}
			}
			reference += "\n";
		}
	}
	
	return reference;
}

/**
 * Get command examples for common user intents
 */
export const COMMAND_EXAMPLES: Record<string, { intent: string; command: string; example: string }[]> = {
	"send_sms": [
		{
			intent: "Send SMS to a phone number",
			command: "sms_sms_create",
			example: 'User: "Send a text to +19492459055 saying hello"\nAI: Use sms_sms_create with {"body": {"to": "+19492459055", "body": "hello"}}',
		},
	],
	"make_call": [
		{
			intent: "Make a phone call",
			command: "calls_agents_create",
			example: 'User: "Call +19492459055"\nAI: Use calls_agents_create with {"agentId": "agent_3901kffpqtbge0ev6cve7fgcvbkg", "body": {"to": "+19492459055"}}',
		},
	],
	"create_contact": [
		{
			intent: "Create a new contact",
			command: "contacts_create",
			example: 'User: "Add Jared Lutz with phone +19492459055"\nAI: Use contacts_create with {"body": {"firstName": "Jared", "lastName": "Lutz", "phone": "+19492459055"}}',
		},
	],
};
