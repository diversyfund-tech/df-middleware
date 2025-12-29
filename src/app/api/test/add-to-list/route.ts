import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { callListRegistry, contactMappings } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getCallLists, getCallList, updateCallList, addContactsToList } from "@/lib/aloware/client";
import { ensureCallList } from "@/lib/aloware/lists/ensureCallList";
import { applyListMembershipChange } from "@/lib/aloware/lists/applyMembership";

export const dynamic = "force-dynamic";

/**
 * Test endpoint to add a contact to DF_RAFI_NEW_LEADS
 * 
 * Usage:
 * POST /api/test/add-to-list?ghlContactId=<GHL_CONTACT_ID>
 */
export async function POST(req: NextRequest) {
	try {
		const url = new URL(req.url);
		const ghlContactId = url.searchParams.get("ghlContactId");

		if (!ghlContactId) {
			return NextResponse.json(
				{ error: "ghlContactId query parameter is required" },
				{ status: 400 }
			);
		}

		const results: {
			ghlContactId: string;
			steps: Array<Record<string, unknown>>;
		} = {
			ghlContactId,
			steps: [],
		};

		// Step 1: Find the list
		results.steps.push({ step: "1", action: "Finding DF_RAFI_NEW_LEADS list" });
		
		let listId: string;
		try {
			listId = await ensureCallList("RAFI", "NEW_LEADS");
			results.steps.push({ 
				step: "1", 
				status: "success", 
				message: `Found list ID: ${listId}`,
				listId 
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			results.steps.push({ 
				step: "1", 
				status: "error", 
				message: `Failed to find list: ${errorMessage}` 
			});
			return NextResponse.json(results, { status: 500 });
		}

		// Step 2: Get list details
		results.steps.push({ step: "2", action: "Fetching list details from Aloware" });
		try {
			const list = await getCallList(listId);
			results.steps.push({ 
				step: "2", 
				status: "success", 
				message: "List details retrieved",
				listName: list?.name,
				currentContactCount: list?.contact_ids?.length || 0,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			results.steps.push({ 
				step: "2", 
				status: "error", 
				message: `Failed to get list details: ${errorMessage}` 
			});
		}

		// Step 3: Try to add contact using applyListMembershipChange (full flow)
		results.steps.push({ step: "3", action: "Adding contact via applyListMembershipChange" });
		try {
			await applyListMembershipChange({
				ghlContactId,
				agentKey: "RAFI",
				addListKeys: ["NEW_LEADS"],
				removeListKeys: [],
				correlationId: `test-${Date.now()}`,
			});
			results.steps.push({ 
				step: "3", 
				status: "success", 
				message: "Contact added successfully via applyListMembershipChange" 
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			results.steps.push({ 
				step: "3", 
				status: "error", 
				message: `Failed to add contact: ${errorMessage}`,
				errorDetails: errorMessage,
			});

			// Step 4: Try direct API call to see what happens
			results.steps.push({ step: "4", action: "Testing direct API call to updateCallList" });
			
			// First, get the contact mapping to get Aloware contact ID
			const mapping = await db.query.contactMappings.findFirst({
				where: eq(contactMappings.ghlContactId, ghlContactId),
			});

			if (mapping?.alowareContactId) {
				try {
					const list = await getCallList(listId);
					const existingIds = list?.contact_ids || [];
					const newIds = [...new Set([...existingIds, mapping.alowareContactId])];
					
					results.steps.push({ 
						step: "4a", 
						action: `Attempting PUT to /call-lists/${listId} with ${newIds.length} contacts` 
					});

					const updated = await updateCallList(listId, { contact_ids: newIds });
					results.steps.push({ 
						step: "4a", 
						status: "success", 
						message: "Direct API call succeeded",
						updatedContactCount: updated.contact_ids?.length || 0,
					});
				} catch (directError) {
					const directErrorMessage = directError instanceof Error ? directError.message : String(directError);
					results.steps.push({ 
						step: "4a", 
						status: "error", 
						message: `Direct API call failed: ${directErrorMessage}`,
						errorDetails: directErrorMessage,
					});
				}
			} else {
				results.steps.push({ 
					step: "4", 
					status: "skipped", 
					message: "No Aloware contact mapping found - contact needs to be synced first" 
				});
			}
		}

		// Step 5: Verify final state
		results.steps.push({ step: "5", action: "Verifying final list state" });
		try {
			const finalList = await getCallList(listId);
			results.steps.push({ 
				step: "5", 
				status: "success", 
				message: "Final list state retrieved",
				finalContactCount: finalList?.contact_ids?.length || 0,
				contactIds: finalList?.contact_ids || [],
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			results.steps.push({ 
				step: "5", 
				status: "error", 
				message: `Failed to verify: ${errorMessage}` 
			});
		}

		return NextResponse.json(results, { status: 200 });
	} catch (error) {
		console.error("[test/add-to-list] Error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json(
			{ error: message, details: error instanceof Error ? error.stack : undefined },
			{ status: 500 }
		);
	}
}

