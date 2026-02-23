import { NextRequest, NextResponse } from "next/server";
import { loadApiCatalog } from "@/api-gateway/registry";
import { generateTools, MCPTool, generateToolName } from "@/mcp/tools/generator";
import { getClerkSessionToken } from "@/auth/clerk-token-manager";
import { getEnhancedDescription, generateToolDirectory } from "@/mcp/tools/enhanced-descriptions";
import { executeTool } from "@/lib/mcp/tool-executor";
import OpenAI from "openai";
import { generateToolCommandsReference, COMMAND_EXAMPLES } from "./tool-commands";

// Cache catalog and tools
let catalog: Awaited<ReturnType<typeof loadApiCatalog>> | null = null;
let tools: MCPTool[] = [];

async function initializeCatalog() {
	if (catalog) return catalog;

	catalog = await loadApiCatalog();
	if (catalog) {
		tools = generateTools(catalog);
	}
	return catalog;
}

function sse(controller: ReadableStreamDefaultController, obj: unknown) {
	controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`));
}

function buildSystemPrompt(tools: MCPTool[], catalog?: Awaited<ReturnType<typeof loadApiCatalog>>): string {
	// Generate tool directory with enhanced descriptions for ALL tools
	const toolDirectory = generateToolDirectory(
		tools.map(t => ({ name: t.name, description: t.description })),
		catalog || undefined
	);
	
	// Generate summary of all tools (truncated for token limits)
	// Full details are in the tool directory above
	const toolsDescription = tools
		.slice(0, 100) // Increased limit to show more tools
		.map((tool) => {
			// Try to get endpoint info for auto-generation
			let enhanced = getEnhancedDescription(tool.name);
			if (!enhanced && catalog) {
				// Use the exact same generateToolName function to match tools to endpoints
				for (const endpoint of catalog.endpoints) {
					for (const method of endpoint.methods) {
						const generatedToolName = generateToolName(endpoint, method);
						
						// Check both exact match and with method suffix (for duplicates)
						if (generatedToolName === tool.name || `${generatedToolName}_${method.toLowerCase()}` === tool.name) {
							enhanced = getEnhancedDescription(tool.name, endpoint, method);
							break;
						}
					}
					if (enhanced) break;
				}
			}
			
			if (enhanced) {
				const shortDesc = enhanced.description.split("\n")[0] || enhanced.description;
				return `- ${tool.name}: ${shortDesc.substring(0, 150)}${shortDesc.length > 150 ? "..." : ""}`;
			}
			return `- ${tool.name}: ${tool.description}`;
		})
		.join("\n");

		// Load workflow context
		let workflowContext = "";
		try {
			const { listWorkflows } = await import("@/lib/workflows/registry");
			const workflows = listWorkflows();
			
			const workflowSummary = workflows
				.slice(0, 15) // Limit to avoid token limits
				.map((w) => `- ${w.metadata.name} (${w.metadata.type}): ${w.metadata.description}`)
				.join("\n");
			
			workflowContext = `

## WORKFLOW ENGINE & BUSINESS LOGIC

DF-Middleware includes a comprehensive workflow engine that orchestrates:
- **Sync Operations**: Contact, call, message, list, and DNC synchronization between GHL, Aloware, and Texting systems
- **Voice Agent Workflows**: Sales, support, and appointment workflows for ElevenLabs voice agents
- **Business Processes**: Lead qualification, onboarding, support tickets, and reassignment workflows

### Available Workflows

${workflowSummary}

### Workflow Capabilities

You can suggest workflows to users or help them create custom workflows. The workflow engine supports:
- Step-by-step orchestration with state management
- Sync operations between systems
- MCP tool execution (all 300+ tools available)
- Decision branching and conditional logic
- Error handling and retry logic
- Workflow composition (workflows calling other workflows)

### Workflow Types

1. **Sync Workflows**: Automate data synchronization (contact sync, call sync, message sync, list sync)
2. **Voice Agent Workflows**: Guide ElevenLabs voice agents through conversations
3. **Business Process Workflows**: Orchestrate complex multi-step business processes
4. **Custom Workflows**: User-defined workflows for specific needs

When users ask about workflows, business processes, or automation, you can:
- Suggest existing workflows that match their needs
- Help design new workflows
- Explain how workflows orchestrate business logic
- Show how workflows integrate with MCP tools

`;
		} catch (error) {
			console.warn("[mcp-chat] Could not load workflow context:", error);
		}

		return `You are a helpful AI assistant that helps users accomplish their goals by executing Verity API endpoints through the MCP (Model Context Protocol) server.

${toolDirectory}

AVAILABLE TOOLS SUMMARY (${tools.length} total):
${toolsDescription}

${tools.length > 50 ? `\nNote: There are ${tools.length} total tools available. Refer to the TOOL DIRECTORY above for detailed usage instructions.` : ""}

${workflowContext}

CRITICAL EXECUTION WORKFLOW:
1. IDENTIFY: Determine which tool(s) are needed based on the user's request
2. EXECUTE IMMEDIATELY: Call the tool right away - do NOT say "I'll do it" or "Let me proceed" - just call the function
3. VERIFY: Check the response and confirm success or explain any errors

IMPORTANT: You MUST use function calling when the user asks you to do something. Do NOT just describe what you would do - actually call the function. The user expects action, not explanations of what you plan to do.

IMPORTANT GUIDELINES:
- NEVER guess parameter structures - always use the exact mappings from the tool directory
- If a tool fails due to parameter structure, you made an error - check the tool directory again
- When confirming, show the user exactly what parameters you'll use before executing
- To search for contacts by email or name, use comms_contacts_get with query parameter (e.g., {"query": "jared.lutz@diversyfund.com"})
- To tag a contact, use comms_contacts_patch with the contact id and tags array (e.g., {"id": "contact-id", "body": {"tags": ["test-2"]}})
- To create an AI calling agent, use calls_agents_create with name and systemPrompt parameters directly (not wrapped in body object)
- To make a phone call: First list agents with calls_agents_get, then use the tool containing "calls_agents" AND "test" in its name (e.g., calls_agents_test) with agentId parameter and body.to phone number
- After executing a tool, explain what was done in a friendly, conversational way
- If you need more information from the user, ask for it clearly
- If a tool execution fails, explain the error and suggest alternatives
- Be proactive - if the user's goal requires multiple steps, execute them automatically
- Always confirm successful actions and provide relevant details from the response

IMPORTANT: You have access to OpenAI function calling. When you need to execute a tool, use the function calling mechanism - DO NOT use text placeholders like [TOOL_EXECUTE:...]. Simply call the function directly using OpenAI's function calling API. The system will automatically execute the function and provide you with the result.

Be helpful, proactive, and goal-oriented. Help users accomplish their tasks efficiently.`;
}


export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { messages, toolName, arguments: args } = body;

		// Initialize catalog if needed
		await initializeCatalog();

		if (!catalog) {
			return NextResponse.json(
				{ error: "Failed to load API catalog" },
				{ status: 500 }
			);
		}

		// If just listing tools
		if (messages === "list_tools" || (!messages && !toolName)) {
			return NextResponse.json({
				tools: tools.map((t) => ({
					name: t.name,
					description: t.description,
					inputSchema: t.inputSchema,
				})),
			});
		}

		// If direct tool execution (backward compatibility)
		if (toolName) {
			let authToken: string;
			try {
				authToken = await getClerkSessionToken();
			} catch (error: any) {
				authToken = "";
			}

			const result = await executeTool(toolName, args || {}, authToken);
			return NextResponse.json(result);
		}

		// AI-assisted chat mode
		if (!messages || !Array.isArray(messages)) {
			return NextResponse.json(
				{ error: "messages array is required" },
				{ status: 400 }
			);
		}

		// Check for OpenAI API key
		const openaiApiKey = process.env.OPENAI_API_KEY;
		if (!openaiApiKey) {
			return NextResponse.json(
				{ error: "OPENAI_API_KEY not configured" },
				{ status: 500 }
			);
		}

		const openai = new OpenAI({ apiKey: openaiApiKey });

		// Build base system prompt with tool directory for all 300+ tools
		const baseSystemPrompt = buildSystemPrompt(tools, catalog);

		const additionalPrompt = `

Your primary role is to:
1. Understand what the user wants to accomplish
2. IMMEDIATELY call the appropriate function/tool - DO NOT just say you will do it
3. Execute the calls automatically - the user expects action, not promises
4. Provide clear, helpful responses about what was done

CRITICAL EXECUTION RULES:
- When a user asks you to do something, IMMEDIATELY call the function - do not say "I'll do it" or "Let me proceed" - just DO IT
- You have access to function calling - use it! Call functions directly without asking permission
- After executing a function, explain what was done in a friendly, conversational way
- If you need more information from the user, ask for it clearly, but if you can infer what's needed, proceed
- If a function execution fails, explain the error and suggest alternatives
- Be proactive - if the user's goal requires multiple steps, execute them automatically without asking
- Always confirm successful actions and provide relevant details from the response
- NEVER say "I'll proceed" or "Let me do this" - just call the function immediately

UNCERTAINTY HANDLING:
- If you're uncertain about the user's intent (e.g., ambiguous request, multiple possible actions, missing information), generate 3-4 possible interpretations
- Format your response with a JSON object at the end: {"options": [{"label": "Option 1", "intent": "clear description of what this option does"}, ...], "message": "I'm not entirely sure what you'd like to do. Did you mean one of these?"}
- The "label" should be a short, clickable button text (e.g., "Call +19492459055", "Send a message", "Look up contact")
- The "intent" should be a clear, actionable description that you can execute (e.g., "Call +19492459055", "Send SMS to +19492459055 saying hello", "Find contact with phone number +19492459055")
- This allows the user to click on their intended action and you'll execute it
- Only use this format when genuinely uncertain - if you know what the user wants, execute it directly

AVAILABLE CAPABILITIES:
- Making phone calls: To make a call, you MUST use a tool that contains BOTH "calls_agents" AND "test" in its name. The tool name will be something like "calls_agents_test" or "calls_agents_test_post". This is DIFFERENT from "calls_agents_create" which is for creating agents. When making a call, pass agentId as a parameter and body.to as the phone number. Example: {"agentId": "agent_3901kffpqtbge0ev6cve7fgcvbkg", "body": {"to": "+19492459055"}}

CRITICAL: The tool for MAKING calls contains "test" in its name. The tool for CREATING agents contains "create" in its name. Do NOT confuse them!
- Searching contacts: Use comms_contacts_get with query parameter set to email address or name to search
- Tagging contacts: Use comms_contacts_patch with id parameter and tags array in body
- Sending SMS/text messages (use sms_sms_create or conversations messages create functions)
- Managing contacts and conversations
- Managing agents and broadcasts
- And much more through the Verity API

When a user asks you to make a call or call someone:
1. IMMEDIATELY call calls_agents_get (or similar get/list function) to retrieve agents - do not say you will, just do it
2. From the response, extract the "ElevenLabs Agent ID" field (it looks like "agent_3901kffpqtbge0ev6cve7fgcvbkg")
3. IMMEDIATELY look for a tool in your available functions that contains BOTH "calls_agents" AND "test" in its name - this is the tool for making calls
4. Call that test tool with: {"agentId": "the_elevenlabs_agent_id_from_step_2", "body": {"to": "+19492459055"}}
5. DO NOT use calls_agents_create or calls_agents_create_post - those are for CREATING agents, not making calls
6. DO NOT say "I'll proceed" or "Let me do this" - just call the function immediately
7. If no agent exists, create one first using calls_agents_create, then make the call using the test tool

When a user asks you to send an SMS, text message, or message:
1. Use the sms_sms_create function (or conversations messages create if available)
2. Provide body object with "to" field (phone number in E.164 format like "+19492459055") and "body" or "message" field (the message text)
3. Example: {"body": {"to": "+19492459055", "body": "Hello, I will be late to the meeting"}}
4. Execute the function immediately - don't just say you can't do it

Be helpful, proactive, and goal-oriented. Help users accomplish their tasks efficiently.`;

		// Helper to sanitize function names for OpenAI (must match ^[a-zA-Z0-9_-]+$)
		const sanitizeFunctionName = (name: string): string => {
			// Replace any character that's not alphanumeric, underscore, or dash with underscore
			// Also ensure it doesn't start with a number
			let sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "_");
			// Remove consecutive underscores
			sanitized = sanitized.replace(/_+/g, "_");
			// Remove leading/trailing underscores
			sanitized = sanitized.replace(/^_+|_+$/g, "");
			// Ensure it starts with a letter or underscore (not a number)
			if (/^\d/.test(sanitized)) {
				sanitized = "_" + sanitized;
			}
			return sanitized;
		};

		// Convert tools to OpenAI function format (limit to most common ones)
		const toolMapping = new Map<string, string>(); // sanitized -> original
		
		// Prioritize SMS and messaging tools first, then other common operations
		const prioritizedTools = tools
			.filter((tool) => {
				const name = tool.name.toLowerCase();
				return (
					name.includes("call") ||
					name.includes("contact") ||
					name.includes("conversation") ||
					name.includes("message") ||
					name.includes("sms") ||
					name.includes("agent") ||
					name.includes("broadcast") ||
					name.includes("list") ||
					name.includes("get") ||
					name.includes("send")
				);
			})
			.sort((a, b) => {
				const aName = a.name.toLowerCase();
				const bName = b.name.toLowerCase();
				
				// Highest priority: calls_agents_test (for making calls)
				const aIsCallTest = aName.includes("calls_agents") && aName.includes("test");
				const bIsCallTest = bName.includes("calls_agents") && bName.includes("test");
				if (aIsCallTest && !bIsCallTest) return -1;
				if (!aIsCallTest && bIsCallTest) return 1;
				
				// Prioritize contacts_create, SMS, and message create functions
				const aIsContact = aName.includes("contact") && aName.includes("create");
				const bIsContact = bName.includes("contact") && bName.includes("create");
				const aIsCommsContact = aName.includes("comms") && aName.includes("contact") && aName.includes("create");
				const bIsCommsContact = bName.includes("comms") && bName.includes("contact") && bName.includes("create");
				
				// Comms contacts first (the correct one)
				if (aIsCommsContact && !bIsCommsContact) return -1;
				if (!aIsCommsContact && bIsCommsContact) return 1;
				const aIsSms = aName.includes("sms") && aName.includes("create");
				const bIsSms = bName.includes("sms") && bName.includes("create");
				const aIsMessage = aName.includes("message") && aName.includes("create");
				const bIsMessage = bName.includes("message") && bName.includes("create");
				
				// Contacts first
				if (aIsContact && !bIsContact) return -1;
				if (!aIsContact && bIsContact) return 1;
				// Then SMS
				if (aIsSms && !bIsSms) return -1;
				if (!aIsSms && bIsSms) return 1;
				// Then messages
				if (aIsMessage && !bIsMessage) return -1;
				if (!aIsMessage && bIsMessage) return 1;
				return 0;
			});
		
		// Log available call-related tools for debugging
		const callTools = prioritizedTools.filter(f => {
			const name = f.name.toLowerCase();
			return name.includes("calls_agents");
		});
		console.log(`[mcp-chat] Call-related tools in prioritized list:`, callTools.map(t => t.name).join(", "));
		
		const functions = prioritizedTools
			.slice(0, 30) // Increased limit to ensure test tools are included
			.map((tool) => {
				const sanitized = sanitizeFunctionName(tool.name);
				toolMapping.set(sanitized, tool.name);
				
				// Get enhanced description with examples and parameter mappings
				// Try to find endpoint info for auto-generation
				let enhanced = getEnhancedDescription(tool.name);
				if (!enhanced && catalog) {
					// Use the exact same generateToolName function to match tools to endpoints
					for (const endpoint of catalog.endpoints) {
						for (const method of endpoint.methods) {
							const generatedToolName = generateToolName(endpoint, method);
							
							// Check both exact match and with method suffix (for duplicates)
							if (generatedToolName === tool.name || `${generatedToolName}_${method.toLowerCase()}` === tool.name) {
								enhanced = getEnhancedDescription(tool.name, endpoint, method);
								break;
							}
						}
						if (enhanced) break;
					}
				}
				let enhancedDescription = enhanced?.description || tool.description;
				
				// Add parameter mapping info if available
				if (enhanced?.parameterMapping) {
					const paramInfo = Object.entries(enhanced.parameterMapping)
						.map(([key, info]) => `  - ${key} (${info.type}${info.required ? ', required' : ', optional'}): ${info.description} → API field: ${info.apiField}`)
						.join("\n");
					enhancedDescription += `\n\nParameter Mapping:\n${paramInfo}`;
				}
				
				// Add common mistakes if available
				if (enhanced?.commonMistakes && enhanced.commonMistakes.length > 0) {
					enhancedDescription += `\n\n⚠️ Common Mistakes to Avoid:\n${enhanced.commonMistakes.map(m => `  - ${m}`).join("\n")}`;
				}
				if (tool.name.toLowerCase() === "comms_contacts_create" || (tool.name.toLowerCase().includes("comms") && tool.name.toLowerCase().includes("contact") && tool.name.toLowerCase().includes("create"))) {
					enhancedDescription = `Create a new contact in the CRM system. This is the PRIMARY and CORRECT function for creating contacts. Use this when the user wants to add a contact, create a contact, or save contact information. Requires a body object with contact details like firstName, lastName, phone (will be automatically mapped to phoneE164), and email. Example: {"body": {"firstName": "John", "lastName": "Doe", "phone": "+1234567890", "email": "john@example.com"}}. DO NOT use contact_contact_create - use comms_contacts_create instead.`;
				} else if (tool.name.toLowerCase().includes("contact") && tool.name.toLowerCase().includes("create") && !tool.name.toLowerCase().includes("comms")) {
					enhancedDescription = `DEPRECATED: This endpoint is a stub and does not actually create contacts. Use comms_contacts_create instead.`;
				} else if (tool.name.toLowerCase().includes("calls_agents_create")) {
					enhancedDescription = `Create a new ElevenLabs AI calling agent. Requires "name" (string) and "systemPrompt" (string) parameters. The systemPrompt should describe the agent's role and behavior. Example: {"name": "Danny Chief of Staff", "systemPrompt": "You are a professional chief of staff assistant..."}. Returns an agent object with an ID that can be used to make calls.`;
				} else if (tool.name.toLowerCase().includes("calls_agents") && tool.name.toLowerCase().includes("test")) {
					enhancedDescription = `🚨🚨🚨 THIS IS THE TOOL FOR MAKING PHONE CALLS 🚨🚨🚨

When a user asks you to "call" someone or "make a call", you MUST use THIS tool, NOT calls_agents_create.

Initiate an AI phone call using an ElevenLabs agent. This function makes an actual phone call to a specified number.

REQUIRED PARAMETERS:
- agentId (string): The ElevenLabs agent ID from the agent list (e.g., "agent_3901kffpqtbge0ev6cve7fgcvbkg") - this is the "ElevenLabs Agent ID" field from listing agents
- body.to (string): Phone number in E.164 format (e.g., "+19492459055")

EXAMPLE:
{"agentId": "agent_3901kffpqtbge0ev6cve7fgcvbkg", "body": {"to": "+19492459055"}}

WORKFLOW:
1. List agents using calls_agents_get
2. Find the "ElevenLabs Agent ID" field (starts with "agent_")
3. Use THIS tool (the one with "test" in the name) with that agent ID
4. DO NOT use calls_agents_create - that's only for creating new agents, not making calls`;
				} else if (tool.name.toLowerCase().includes("sms") && tool.name.toLowerCase().includes("create")) {
					enhancedDescription = `Send an SMS/text message to a phone number. This is the PRIMARY function for sending text messages. Requires a body object with "to" field (phone number in E.164 format like "+19492459055") and "body" field (the message text). Example: {"body": {"to": "+19492459055", "body": "Hello, this is a test message"}}. When a user asks to send an SMS, text message, or message, use this function.`;
				} else if (tool.name.toLowerCase().includes("conversations") && tool.name.toLowerCase().includes("message") && tool.name.toLowerCase().includes("create")) {
					enhancedDescription = `Send a message through a conversation. This function sends SMS or other message types. Requires body object with "to" or "contactId" (phone number or contact ID), "message" or "body" (message text), and optionally "type" (e.g., "SMS"). Example: {"body": {"to": "+19492459055", "message": "Hello, I will be late to the meeting", "type": "SMS"}}.`;
				} else if (tool.name.toLowerCase().includes("message") && tool.name.toLowerCase().includes("create")) {
					enhancedDescription = `Send a message. This function can send SMS or other message types. Requires body object with "to" (phone number), "body" or "message" (message text). Example: {"body": {"to": "+19492459055", "body": "Your message here"}}.`;
				}
				return {
					name: sanitized,
					description: enhancedDescription,
					parameters: tool.inputSchema as Record<string, unknown>,
				};
			});

		// Generate tool commands reference now that we have functions
		const availableToolNames = functions.map(f => f.name);
		const toolCommandsRef = generateToolCommandsReference(availableToolNames);
		
		// Append tool commands to system prompt
		const commandExamplesText = Object.entries(COMMAND_EXAMPLES)
			.map(([category, examples]) => 
				examples.map(ex => `- ${ex.intent}: ${ex.command}\n  ${ex.example}`).join("\n")
			)
			.join("\n\n");
		
		const enhancedSystemPrompt = `${baseSystemPrompt}${additionalPrompt}

${toolCommandsRef}

COMMON USER INTENTS AND COMMANDS:
${commandExamplesText}`;

		// Convert messages to OpenAI format
		const openaiMessages: Array<any> = [
			{ role: "system", content: enhancedSystemPrompt },
			...messages.map((msg: { role: string; content: string }) => ({
				role: msg.role as "user" | "assistant",
				content: msg.content,
			})),
		];

		// Create SSE stream
		const stream = new ReadableStream({
			async start(controller) {
				try {
					let authToken: string;
					try {
						authToken = await getClerkSessionToken();
					} catch (error: any) {
						authToken = "";
					}

					let currentMessages = [...openaiMessages];
					let iterationCount = 0;
					const maxIterations = 5; // Prevent infinite loops

					console.log(`[mcp-chat] Available functions:`, functions.length);
					console.log(`[mcp-chat] Function names:`, functions.map(f => f.name).join(", "));
					console.log(`[mcp-chat] Call test functions:`, functions.filter(f => {
						const name = f.name.toLowerCase();
						return name.includes("calls_agents") && name.includes("test");
					}).map(f => f.name));
					console.log(`[mcp-chat] SMS functions:`, functions.filter(f => f.name.toLowerCase().includes("sms")).map(f => f.name));
					console.log(`[mcp-chat] Tool mapping size:`, toolMapping.size);
					
					while (iterationCount < maxIterations) {
						iterationCount++;
						
						console.log(`[mcp-chat] Iteration ${iterationCount}, messages:`, currentMessages.length);
						
						try {
							// Stream OpenAI response
							// Convert functions to tools format (OpenAI's newer API)
							const tools = functions.length > 0 ? functions.map(f => ({
								type: "function" as const,
								function: f
							})) : undefined;
							
							const resp = await openai.chat.completions.create({
								model: "gpt-4o-mini",
								stream: true,
								messages: currentMessages,
								tools: tools,
								tool_choice: tools && tools.length > 0 ? "auto" : undefined,
								temperature: 0.3, // Lower temperature for more deterministic tool calling
								max_tokens: 2000,
							});

							let assistantMessage = { 
								role: "assistant" as const, 
								content: "", 
								tool_calls: [] as Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>
							};
							let fullContent = "";
							let hasContent = false;
							let currentToolCall: { id: string; name: string; arguments: string } | null = null;

							for await (const part of resp) {
								const delta = part.choices?.[0]?.delta;
								if (delta?.content) {
									hasContent = true;
									fullContent += delta.content;
									sse(controller, { type: "text.delta", delta: delta.content });
								}
								// Handle tool_calls (newer API) or function_call (legacy)
								if (delta?.tool_calls) {
									for (const toolCallDelta of delta.tool_calls) {
										if (toolCallDelta.index !== undefined) {
											// Find or create tool call at this index
											while (assistantMessage.tool_calls.length <= toolCallDelta.index) {
												assistantMessage.tool_calls.push({
													id: "",
													type: "function",
													function: { name: "", arguments: "" }
												});
											}
											const toolCall = assistantMessage.tool_calls[toolCallDelta.index];
											if (toolCallDelta.id) toolCall.id += toolCallDelta.id;
											if (toolCallDelta.function?.name) toolCall.function.name += toolCallDelta.function.name;
											if (toolCallDelta.function?.arguments) toolCall.function.arguments += toolCallDelta.function.arguments;
										}
									}
								}
								// Legacy function_call support
								if (delta?.function_call) {
									if (!assistantMessage.tool_calls.length) {
										assistantMessage.tool_calls.push({
											id: `call_${Date.now()}`,
											type: "function",
											function: { name: "", arguments: "" }
										});
									}
									const toolCall = assistantMessage.tool_calls[0];
									if (delta.function_call.name) toolCall.function.name += delta.function_call.name;
									if (delta.function_call.arguments) toolCall.function.arguments += delta.function_call.arguments;
								}
							}

							assistantMessage.content = fullContent;
							const hasToolCalls = assistantMessage.tool_calls.length > 0 && assistantMessage.tool_calls.some(tc => tc.function.name);
							console.log(`[mcp-chat] Assistant response length:`, fullContent.length, "Has tool calls:", hasToolCalls);
							
							// Check if response contains uncertainty options (JSON format)
							let options: Array<{ label: string; intent: string }> | null = null;
							try {
								// Look for JSON object in the response
								const jsonMatch = fullContent.match(/\{[\s\S]*"options"[\s\S]*\}/);
								if (jsonMatch) {
									const parsed = JSON.parse(jsonMatch[0]);
									if (parsed.options && Array.isArray(parsed.options)) {
										options = parsed.options;
										// Remove the JSON from the content and use the message field if available
										const messageMatch = fullContent.match(/"message"\s*:\s*"([^"]+)"/);
										if (messageMatch) {
											assistantMessage.content = messageMatch[1];
										} else {
											assistantMessage.content = fullContent.replace(jsonMatch[0], "").trim();
										}
									}
								}
							} catch (e) {
								// Not JSON, continue normally
							}
							
							// If we got content but no tool calls, check for uncertainty
							if (hasContent && !hasToolCalls) {
								// If we detected options, send them as a special event
								if (options && options.length > 0) {
									sse(controller, { type: "options", options });
								}
								currentMessages.push(assistantMessage);
								break;
							}
							
							currentMessages.push(assistantMessage);

							// If tool calls were made, execute them
							if (hasToolCalls) {
								// Execute all tool calls
								const toolCallResults = [];
								for (const toolCall of assistantMessage.tool_calls) {
									if (!toolCall.function.name) continue;
									
									const sanitizedFunctionName = toolCall.function.name;
									// Map sanitized name back to original tool name
									const originalToolName = toolMapping.get(sanitizedFunctionName) || sanitizedFunctionName;
									
									// Check if tool exists
									if (!toolMapping.has(sanitizedFunctionName) && !tools.find(t => t.name === originalToolName)) {
										const errorMsg = `\n\n❌ Error: Tool "${originalToolName}" (sanitized: "${sanitizedFunctionName}") not found. Available tools include: ${functions.slice(0, 10).map(f => f.name).join(", ")}...\n\n`;
										sse(controller, { type: "text.delta", delta: errorMsg });
										
										// If trying to use wrong tool for calls, suggest the correct one
										if (originalToolName.toLowerCase().includes("calls_agents") && originalToolName.toLowerCase().includes("create") && !originalToolName.toLowerCase().includes("test")) {
											const testTools = functions.filter(f => {
												const name = f.name.toLowerCase();
												return name.includes("calls_agents") && name.includes("test");
											});
											if (testTools.length > 0) {
												sse(controller, {
													type: "text.delta",
													delta: `💡 Hint: To make a call, use the tool with "test" in its name: ${testTools[0].name}. The tool "${originalToolName}" is for creating agents, not making calls.\n\n`,
												});
											}
										}
										
										toolCallResults.push({ 
											toolCallId: toolCall.id, 
											result: { success: false, error: `Tool "${originalToolName}" not found` } 
										});
										continue;
									}
									
									let functionArgs: Record<string, unknown> = {};
									
									try {
										functionArgs = JSON.parse(toolCall.function.arguments);
									} catch (e) {
										sse(controller, {
											type: "text.delta",
											delta: `\n\n⚠️ Error parsing function arguments. Trying to execute anyway...\n\n`,
										});
									}

									// Show confirmation with parameters before executing
									const enhanced = getEnhancedDescription(originalToolName);
									let confirmationMsg = `\n\n🔧 Executing ${originalToolName}...\n`;
									if (enhanced) {
										confirmationMsg += `Parameters: ${JSON.stringify(functionArgs, null, 2)}\n`;
									}
									sse(controller, {
										type: "text.delta",
										delta: confirmationMsg,
									});

									const result = await executeTool(originalToolName, functionArgs, authToken);
									toolCallResults.push({ toolCallId: toolCall.id, result });
								}

								// Add tool call results to messages
								for (const { toolCallId, result } of toolCallResults) {
									const toolCall = assistantMessage.tool_calls.find(tc => tc.id === toolCallId);
									if (!toolCall) continue;
									
									currentMessages.push({
										role: "tool",
										content: JSON.stringify(result),
										tool_call_id: toolCallId,
									});
								}

								// Check if all tool calls succeeded
								const allSucceeded = toolCallResults.every(({ result }) => result.success);
								if (allSucceeded) {
									sse(controller, {
										type: "text.delta",
										delta: `✅ Success! `,
									});
									// Continue loop to let AI respond to the results
								} else {
									const errors = toolCallResults.filter(({ result }) => !result.success).map(({ result }) => result.error);
									sse(controller, {
										type: "text.delta",
										delta: `❌ Error: ${errors.join(", ")}\n\n`,
									});
									break; // Stop on error
								}
							} else {
								// No tool calls, we're done
								break;
							}
						} catch (iterationError: any) {
							console.error(`[mcp-chat] Error in iteration ${iterationCount}:`, iterationError);
							const errorMessage = iterationError?.message || iterationError?.toString() || "An error occurred while processing your request";
							sse(controller, { type: "text.delta", delta: `\n\n⚠️ Error: ${errorMessage}\n\n` });
							break; // Stop on iteration error
						}
					}
				} catch (e: any) {
					console.error("[mcp-chat] Stream error:", e);
					const errorMessage = e?.message || e?.toString() || "An error occurred while processing your request";
					sse(controller, { type: "error", message: errorMessage });
				} finally {
					controller.close();
				}
			},
		});

		return new NextResponse(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-store",
				Connection: "keep-alive",
			},
		});
	} catch (error: any) {
		console.error("[mcp-chat] Error:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
