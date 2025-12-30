import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { contactMappings, messageMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateContact } from "@/lib/ghl/client";
import { addInboundMessage, sendOutboundMessage } from "@/lib/ghl/conversations";
import postgres from "postgres";

export const dynamic = "force-dynamic";

// Verity database connection - using DATABASE_URL from Verity's database
// This is the Neon database for Verity (branch: diversyfund)
const VERITY_DB_URL = process.env.VERITY_DATABASE_URL || "postgresql://neondb_owner:LYtOTMa8rk5p@ep-late-shape-a6nsw636-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// Reusable client instance (connection pool)
let verityClient: ReturnType<typeof postgres> | null = null;

/**
 * Get Verity database client (singleton)
 */
function getVerityDbClient() {
	if (!VERITY_DB_URL) {
		throw new Error("VERITY_DATABASE_URL or DATABASE_URL must be configured for Verity database access");
	}

	if (!verityClient) {
		verityClient = postgres(VERITY_DB_URL);
	}

	return verityClient;
}

/**
 * Get contact info from Verity database
 * Checks both contacts (CRM) and person tables
 */
async function getVerityContact(contactId: string) {
	const client = getVerityDbClient();
	
	// First try contacts table (CRM)
	let result = await client`
		SELECT id, phone_e164 as phone_number, email, first_name, last_name
		FROM contacts
		WHERE id = ${contactId}
	`;

	if (result.length > 0) {
		return (result[0] as unknown) as { id: string; phone_number?: string; email_address?: string; first_name?: string; last_name?: string } | undefined;
	}

	// If not found, try person table
	result = await client`
		SELECT id, phone_number, email_address, first_name, last_name
		FROM person
		WHERE id = ${contactId}
	`;

	return (result[0] as unknown) as { id: string; phone_number?: string; email_address?: string; first_name?: string; last_name?: string } | undefined;
}

/**
 * Get contact ID from a chat message ID
 * Finds the chat, then finds the contact associated with that chat
 */
async function getContactFromChatMessage(messageId: string) {
	const client = getVerityDbClient();
	
	// Get the chat_id from the message
	const messageResult = await client`
		SELECT chat_id, from_phone_number
		FROM chat_message
		WHERE id = ${messageId}
	`;

	if (messageResult.length === 0) {
		return null;
	}

	const chatId = messageResult[0].chat_id;
	const fromPhone = messageResult[0].from_phone_number;

	// Get the contact from chat_participant
	const participantResult = await client`
		SELECT contact_id, phone_number
		FROM chat_participant
		WHERE chat_id = ${chatId}
		AND contact_id IS NOT NULL
		LIMIT 1
	`;

	if (participantResult.length > 0 && participantResult[0].contact_id) {
		// Found a contact_id, return it
		return participantResult[0].contact_id as string;
	}

	// If no contact_id, try to find contact by phone number
	if (fromPhone) {
		const contactByPhone = await client`
			SELECT id
			FROM contacts
			WHERE phone_e164 = ${fromPhone}
			LIMIT 1
		`;

		if (contactByPhone.length > 0) {
			return contactByPhone[0].id as string;
		}
	}

	return null;
}

/**
 * Get conversations (chats) from Verity database for a contact
 * Checks both contacts and person tables for chat participants
 */
async function getVerityConversations(contactId: string) {
	const client = getVerityDbClient();
	
	// First, try to find chats via person table (chat_participant.contact_id references person.id)
	let result = await client`
		SELECT DISTINCT c.id, c.type, c.created_at, c.updated_at
		FROM chat c
		INNER JOIN chat_participant cp ON cp.chat_id = c.id
		WHERE cp.contact_id = ${contactId}
		ORDER BY c.created_at DESC
	`;

	// If no results, try to find via phone number from contacts table
	if (result.length === 0) {
		const contact = await getVerityContact(contactId);
		if (contact?.phone_number) {
			result = await client`
				SELECT DISTINCT c.id, c.type, c.created_at, c.updated_at
				FROM chat c
				INNER JOIN chat_participant cp ON cp.chat_id = c.id
				WHERE cp.phone_number = ${contact.phone_number}
				ORDER BY c.created_at DESC
			`;
		}
	}

	return (result as unknown) as Array<{ id: string; type: string; created_at: Date; updated_at: Date }>;
}

/**
 * Get messages from Verity database for a conversation (chat)
 */
async function getVerityMessages(chatId: string) {
	const client = getVerityDbClient();
	
	// Query Verity's chatMessage table
	const result = await client`
		SELECT 
			id,
			chat_id,
			from_phone_number,
			text,
			type,
			status,
			is_ai_generated,
			telnyx_message_id,
			created_at,
			send_at
		FROM chat_message
		WHERE chat_id = ${chatId}
		ORDER BY created_at ASC
	`;

	return (result as unknown) as Array<{
		id: string;
		chat_id: string;
		from_phone_number: string;
		text: string | null;
		type: string;
		status: string;
		is_ai_generated: boolean;
		telnyx_message_id: string | null;
		created_at: Date;
		send_at: Date | null;
	}>;
}

/**
 * Import conversations from Verity to GHL
 * 
 * POST /api/test/import-verity-conversations
 * Body: { verityContactId: "..." } OR { chatMessageId: "..." }
 */
export async function POST(req: NextRequest) {
	try {
		const { verityContactId, chatMessageId, phone } = await req.json();

		if (!verityContactId && !chatMessageId) {
			return NextResponse.json(
				{ error: "Either verityContactId or chatMessageId is required" },
				{ status: 400 }
			);
		}

		// If chatMessageId is provided, find the contact from that message
		let actualContactId = verityContactId;
		if (chatMessageId && !verityContactId) {
			console.log(`[import-verity] Looking up contact from chat message: ${chatMessageId}`);
			const foundContactId = await getContactFromChatMessage(chatMessageId);
			if (!foundContactId) {
				return NextResponse.json(
					{ 
						error: `Could not find contact from chat message ${chatMessageId}`,
						debug: "Checked chat_participant and contacts tables by phone number"
					},
					{ status: 404 }
				);
			}
			actualContactId = foundContactId;
			console.log(`[import-verity] Found contact ${actualContactId} from chat message ${chatMessageId}`);
		}

		console.log(`[import-verity] Starting import for Verity contact: ${actualContactId}`);

		// Step 1: Get contact info from Verity database to verify and get phone
		let verityContact;
		try {
			console.log(`[import-verity] Looking up contact: ${actualContactId}`);
			verityContact = await getVerityContact(actualContactId);
			console.log(`[import-verity] Contact lookup result:`, verityContact ? "Found" : "Not found");
			if (!verityContact) {
				return NextResponse.json(
					{ 
						error: `Verity contact ${actualContactId} not found`,
						debug: "Checked both 'contacts' and 'person' tables",
						suggestion: "Verify the contact ID exists in Verity database"
					},
					{ status: 404 }
				);
			}
			
			// Use phone from database if not provided
			const contactPhone = phone || verityContact.phone_number;
			if (!contactPhone) {
				return NextResponse.json(
					{ error: "Phone number is required and not found in Verity contact. Please provide phone parameter." },
					{ status: 400 }
				);
			}
			
			// Update phone variable
			const finalPhone = contactPhone;
			
			// Step 2: Get or create GHL contact
			const ghlContactId = await getOrCreateContact(
				verityContact.email_address || undefined,
				finalPhone,
				verityContact.first_name || undefined,
				verityContact.last_name || undefined
			);
			console.log(`[import-verity] GHL contact ID: ${ghlContactId}`);

			// Step 3: Get conversations from Verity database
			const conversations = await getVerityConversations(actualContactId);
			console.log(`[import-verity] Found ${conversations.length} conversations`);

			// Step 4: Import messages from each conversation
			const importedMessages: Array<{ messageId: string; ghlMessageId: string | null }> = [];
			const errors: Array<{ messageId: string; error: string }> = [];

			for (const conversation of conversations) {
				try {
					const messages = await getVerityMessages(conversation.id);
					console.log(`[import-verity] Found ${messages.length} messages in conversation ${conversation.id}`);

					for (const message of messages) {
						try {
							const messageBody = message.text || "";
							if (!messageBody) {
								continue; // Skip empty messages
							}

							// Determine direction: if from_phone_number matches contact phone, it's outbound
							// Otherwise, it's inbound (from the contact to Verity)
							const isOutbound = message.from_phone_number === finalPhone || message.is_ai_generated;
							const direction = isOutbound ? "outbound" : "inbound";

							// Import to GHL with historical timestamp
							let ghlMessageId: string | null = null;
							const messageDate = message.created_at instanceof Date 
								? message.created_at 
								: new Date(message.created_at);
							
							if (direction === "inbound") {
								ghlMessageId = await addInboundMessage(ghlContactId, messageBody, {
									phoneNumber: finalPhone,
									date: messageDate,
								});
							} else {
								ghlMessageId = await sendOutboundMessage(ghlContactId, messageBody, {
									phoneNumber: finalPhone,
									date: messageDate,
								});
							}

							// Store mapping
							await db.insert(messageMappings).values({
								textingMessageId: message.telnyx_message_id || message.id,
								ghlMessageId,
								ghlContactId,
								conversationId: conversation.id,
								fromNumber: message.from_phone_number,
								toNumber: finalPhone, // We'll need to determine the "to" number
								direction: direction as "inbound" | "outbound",
							}).onConflictDoNothing();

							importedMessages.push({ messageId: message.id, ghlMessageId });
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : String(error);
							const errorUrl = (error as { url?: string }).url || "unknown";
							errors.push({ 
								messageId: message.id, 
								error: errorMessage,
								...(errorUrl !== "unknown" ? { url: errorUrl } : {}),
							});
							console.error(`[import-verity] Error importing message ${message.id}:`, error);
						}
					}
				} catch (error) {
					console.error(`[import-verity] Error fetching messages for conversation ${conversation.id}:`, error);
					errors.push({ messageId: conversation.id, error: `Failed to fetch messages: ${error instanceof Error ? error.message : String(error)}` });
				}
			}

			// Update contact mapping
			const existingMapping = await db.query.contactMappings.findFirst({
				where: eq(contactMappings.phoneNumber, finalPhone),
			});

			if (existingMapping) {
				await db.update(contactMappings)
					.set({ ghlContactId })
					.where(eq(contactMappings.id, existingMapping.id));
			} else {
				await db.insert(contactMappings).values({
					alowareContactId: null,
					ghlContactId,
					phoneNumber: finalPhone,
					syncDirection: "bidirectional",
				});
			}

			return NextResponse.json({
				success: true,
				verityContactId: actualContactId,
				chatMessageId: chatMessageId || null,
				ghlContactId,
				phone: finalPhone,
				contactName: `${verityContact.first_name || ""} ${verityContact.last_name || ""}`.trim() || "Unknown",
				conversationsFound: conversations.length,
				messagesImported: importedMessages.length,
				errors: errors.length,
				importedMessages: importedMessages.slice(0, 10), // First 10 for preview
				errorDetails: errors.slice(0, 5), // First 5 errors
			});
		} catch (innerError) {
			console.error("[import-verity] Error in inner try block:", innerError);
			const message = innerError instanceof Error ? innerError.message : "Internal server error";
			return NextResponse.json({ error: message }, { status: 500 });
		}
	} catch (error) {
		console.error("[import-verity] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

