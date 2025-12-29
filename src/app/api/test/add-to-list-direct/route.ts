import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { contactMappings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getCallList, updateCallList } from "@/lib/aloware/client";
import { env } from "@/env";

export const dynamic = "force-dynamic";

/**
 * Direct test endpoint to add a contact to a specific Aloware list
 * 
 * Usage:
 * POST /api/test/add-to-list-direct
 * Body: { "listId": "396726", "ghlContactId": "YOUR_GHL_CONTACT_ID" }
 * 
 * OR
 * 
 * POST /api/test/add-to-list-direct?listId=396726&ghlContactId=YOUR_GHL_CONTACT_ID
 */
export async function POST(req: NextRequest) {
	try {
		const url = new URL(req.url);
		let listId = url.searchParams.get("listId") || "396726"; // Default to the provided list ID
		let ghlContactId = url.searchParams.get("ghlContactId");

		// Try to get from body if not in query params
		if (!ghlContactId) {
			try {
				const body = await req.json().catch(() => ({}));
				listId = body.listId || listId;
				ghlContactId = body.ghlContactId;
			} catch {
				// Body parsing failed, use query params
			}
		}

		if (!ghlContactId) {
			// Try to find any existing GHL contact from mappings
			const anyMapping = await db.query.contactMappings.findFirst();

			if (anyMapping?.ghlContactId) {
				ghlContactId = anyMapping.ghlContactId;
			} else {
				return NextResponse.json(
					{ 
						error: "ghlContactId is required. Provide it as query param or in body.",
						hint: "You can also add a contact mapping first, or provide a GHL contact ID"
					},
					{ status: 400 }
				);
			}
		}

		const results: {
			listId: string;
			ghlContactId: string;
			steps: Array<Record<string, unknown>>;
		} = {
			listId,
			ghlContactId,
			steps: [],
		};

		// Step 1: Get the contact mapping to find Aloware contact ID
		results.steps.push({ step: "1", action: "Finding Aloware contact ID for GHL contact" });
		
		const mapping = await db.query.contactMappings.findFirst({
			where: eq(contactMappings.ghlContactId, ghlContactId),
		});

		if (!mapping?.alowareContactId) {
			results.steps.push({ 
				step: "1", 
				status: "error", 
				message: "No Aloware contact mapping found. Contact needs to be synced to Aloware first.",
				hint: "The contact must exist in Aloware before it can be added to a list. Try syncing the contact first."
			});
			return NextResponse.json(results, { status: 400 });
		}

		const alowareContactId = mapping.alowareContactId;
		results.steps.push({ 
			step: "1", 
			status: "success", 
			message: `Found Aloware contact ID: ${alowareContactId}`,
			alowareContactId 
		});

		// Step 2: Get current list state
		results.steps.push({ step: "2", action: "Fetching current list state" });
		let currentList;
		try {
			currentList = await getCallList(listId);
			results.steps.push({ 
				step: "2", 
				status: "success", 
				message: "List retrieved",
				listName: currentList?.name,
				currentContactCount: currentList?.contact_ids?.length || 0,
				currentContactIds: currentList?.contact_ids || [],
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			results.steps.push({ 
				step: "2", 
				status: "error", 
				message: `Failed to get list: ${errorMessage}`,
				errorDetails: errorMessage,
			});
			return NextResponse.json(results, { status: 500 });
		}

		// Step 3: Add contact to list
		results.steps.push({ step: "3", action: "Adding contact to list via PUT /call-lists/{id}" });
		
		const existingIds = currentList?.contact_ids || [];
		const contactAlreadyInList = existingIds.includes(alowareContactId);
		
		if (contactAlreadyInList) {
			results.steps.push({ 
				step: "3", 
				status: "skipped", 
				message: "Contact is already in the list",
			});
		} else {
			const newIds = [...new Set([...existingIds, alowareContactId])];
			
			try {
				const apiToken = env.ALOWARE_API_TOKEN;
				const payload = {
					contact_ids: newIds,
					api_token: apiToken,
				};

				results.steps.push({ 
					step: "3a", 
					action: `PUT /call-lists/${listId}`,
					payload: { contact_ids_count: newIds.length, api_token: "***" }
				});

				const updated = await updateCallList(listId, { contact_ids: newIds });
				
				results.steps.push({ 
					step: "3", 
					status: "success", 
					message: "Contact added successfully",
					updatedContactCount: updated.contact_ids?.length || 0,
					updatedContactIds: updated.contact_ids || [],
				});
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				const errorStack = error instanceof Error ? error.stack : undefined;
				
				results.steps.push({ 
					step: "3", 
					status: "error", 
					message: `Failed to add contact: ${errorMessage}`,
					errorDetails: errorMessage,
					errorStack: errorStack?.substring(0, 500), // Limit stack trace
				});

				// Check if it's a method not allowed error
				if (errorMessage.includes("405") || errorMessage.includes("Method Not Allowed")) {
					results.steps.push({ 
						step: "3b", 
						status: "info", 
						message: "PUT method not supported. Aloware API may not support programmatic list updates.",
						suggestion: "You may need to use CSV import or a different API endpoint for adding contacts to lists."
					});
				}
			}
		}

		// Step 4: Verify final state
		results.steps.push({ step: "4", action: "Verifying final list state" });
		try {
			const finalList = await getCallList(listId);
			results.steps.push({ 
				step: "4", 
				status: "success", 
				message: "Final verification complete",
				finalContactCount: finalList?.contact_ids?.length || 0,
				contactInList: finalList?.contact_ids?.includes(alowareContactId) || false,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			results.steps.push({ 
				step: "4", 
				status: "error", 
				message: `Failed to verify: ${errorMessage}` 
			});
		}

		return NextResponse.json(results, { status: 200 });
	} catch (error) {
		console.error("[test/add-to-list-direct] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ 
				error: message, 
				details: error instanceof Error ? error.stack : undefined 
			},
			{ status: 500 }
		);
	}
}

