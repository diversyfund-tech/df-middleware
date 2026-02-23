/**
 * ElevenLabs Function Adapter
 * 
 * Maps ElevenLabs function calling format to MCP tool format.
 * Handles parameter transformations and validation.
 */

export interface ElevenLabsFunctionCall {
	name: string;
	arguments: string | Record<string, unknown>; // JSON string or object
}

export interface MCPToolCall {
	toolName: string;
	args: Record<string, unknown>;
}

/**
 * Map ElevenLabs function name to MCP tool name
 * 
 * ElevenLabs might use different naming conventions, so we map them
 */
const FUNCTION_NAME_MAPPING: Record<string, string> = {
	// Common mappings
	"create_contact": "comms_contacts_create",
	"createContact": "comms_contacts_create",
	"send_sms": "sms_sms_create",
	"sendSMS": "sms_sms_create",
	"send_message": "sms_sms_create",
	"book_appointment": "book_appointment", // Special case - uses GHL API directly
	"bookAppointment": "book_appointment",
};

/**
 * Transform ElevenLabs function call to MCP tool call
 */
export function mapElevenLabsFunctionToMCPTool(
	elevenLabsCall: ElevenLabsFunctionCall
): MCPToolCall {
	// Map function name
	const toolName = FUNCTION_NAME_MAPPING[elevenLabsCall.name] || elevenLabsCall.name;

	// Parse arguments
	let args: Record<string, unknown> = {};
	if (typeof elevenLabsCall.arguments === "string") {
		try {
			args = JSON.parse(elevenLabsCall.arguments);
		} catch (error) {
			throw new Error(`Invalid JSON in function arguments: ${elevenLabsCall.arguments}`);
		}
	} else {
		args = elevenLabsCall.arguments;
	}

	// Transform arguments based on tool name
	const transformedArgs = transformToolArgs(toolName, args);

	return {
		toolName,
		args: transformedArgs,
	};
}

/**
 * Transform tool arguments to match MCP tool expectations
 */
function transformToolArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
	// Handle special cases for different tools
	
	if (toolName === "comms_contacts_create") {
		// Ensure body wrapper for contact creation
		if (!args.body && (args.firstName || args.lastName || args.phone || args.email)) {
			return {
				body: {
					firstName: args.firstName,
					lastName: args.lastName,
					phone: args.phone,
					email: args.email,
					tags: args.tags,
					canText: args.canText,
					canEmail: args.canEmail,
				},
			};
		}
	}

	if (toolName === "sms_sms_create") {
		// Ensure body wrapper for SMS
		if (!args.body && (args.to || args.message || args.body)) {
			return {
				body: {
					to: args.to,
					body: args.body || args.message || args.text,
				},
			};
		}
	}

	// Return args as-is if no transformation needed
	return args;
}

/**
 * Validate function call parameters
 */
export function validateFunctionCall(
	elevenLabsCall: ElevenLabsFunctionCall
): { valid: boolean; error?: string } {
	if (!elevenLabsCall.name) {
		return { valid: false, error: "Function name is required" };
	}

	if (!elevenLabsCall.arguments) {
		return { valid: false, error: "Function arguments are required" };
	}

	// Try to parse arguments if string
	if (typeof elevenLabsCall.arguments === "string") {
		try {
			JSON.parse(elevenLabsCall.arguments);
		} catch {
			return { valid: false, error: "Invalid JSON in function arguments" };
		}
	}

	return { valid: true };
}

/**
 * Map MCP tool result back to ElevenLabs format
 */
export function mapMCPResultToElevenLabs(result: {
	success: boolean;
	data?: unknown;
	error?: string;
}): {
	result: string; // JSON string for ElevenLabs
} {
	return {
		result: JSON.stringify(result),
	};
}
