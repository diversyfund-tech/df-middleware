import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { callListRegistry, contactListMemberships, contactMappings } from "@/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getContact as getGhlContact } from "@/lib/ghl/client";
import { resolveAgentForGhlContact } from "@/lib/agents/resolveAgent";
import { resolveListKeysForEvent } from "@/lib/lists/resolveListIntent";
import { applyListMembershipChange } from "@/lib/aloware/lists/applyMembership";
import { getCallList, updateCallList } from "@/lib/aloware/client";

export const dynamic = "force-dynamic";

/**
 * Validate admin secret
 */
function validateAdminSecret(req: NextRequest): boolean {
	const secret = req.headers.get("X-DF-ADMIN-SECRET");
	return secret === env.DF_ADMIN_SECRET;
}

/**
 * Rebuild call lists from GHL data
 * POST /api/admin/lists/rebuild?agentKey=CHRIS&listKey=CALL_NOW
 */
export async function POST(req: NextRequest) {
	if (!validateAdminSecret(req)) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const { searchParams } = new URL(req.url);
	const agentKey = searchParams.get("agentKey");
	const listKey = searchParams.get("listKey");

	let rebuilt = 0;
	let errors = 0;

	try {
		// Get all list registry entries to rebuild
		let registryEntries = await db.query.callListRegistry.findMany({
			where: agentKey && listKey
				? and(
						eq(callListRegistry.agentKey, agentKey),
						eq(callListRegistry.listKey, listKey)
				  )
				: agentKey
					? eq(callListRegistry.agentKey, agentKey)
					: undefined,
		});

		if (agentKey && listKey && registryEntries.length === 0) {
			return NextResponse.json({
				error: `List ${agentKey}/${listKey} not found in registry`,
			}, { status: 404 });
		}

		// If no entries found, return empty result
		if (registryEntries.length === 0) {
			return NextResponse.json({
				rebuilt: 0,
				errors: 0,
				message: "No lists found to rebuild",
			});
		}

		// For each list, rebuild from GHL contacts
		for (const entry of registryEntries) {
			try {
				// Get all active memberships for this agent/listKey
				const memberships = await db.query.contactListMemberships.findMany({
					where: and(
						eq(contactListMemberships.agentKey, entry.agentKey),
						eq(contactListMemberships.listKey, entry.listKey),
						eq(contactListMemberships.status, "active")
					),
				});

				// Get contact mappings to find GHL contact IDs
				const ghlContactIds = memberships.map((m) => m.contactId);
				
				if (ghlContactIds.length === 0) {
					console.log(`[rebuild] No contacts found for ${entry.agentKey}/${entry.listKey}, clearing list`);
					// Clear the list
					if (entry.alowareListId) {
						const list = await getCallList(entry.alowareListId);
						if (list) {
							await updateCallList(entry.alowareListId, { contact_ids: [] });
						}
					}
					continue;
				}

				// Verify contacts still match agent assignment and list intent
				const validContactIds: string[] = [];
				const alowareContactIds: string[] = [];

				for (const ghlContactId of ghlContactIds) {
					try {
						const contact = await getGhlContact(ghlContactId);
						if (!contact) {
							console.warn(`[rebuild] Contact ${ghlContactId} not found in GHL`);
							continue;
						}

						// Verify agent assignment
						const { agentKey: resolvedAgentKey } = await resolveAgentForGhlContact(contact);
						if (resolvedAgentKey !== entry.agentKey) {
							console.log(`[rebuild] Contact ${ghlContactId} no longer assigned to ${entry.agentKey}, skipping`);
							continue;
						}

						// Verify list intent
						const listIntent = await resolveListKeysForEvent("contact.changed", {}, contact);
						if (!listIntent.add.includes(entry.listKey)) {
							console.log(`[rebuild] Contact ${ghlContactId} no longer matches list intent for ${entry.listKey}, skipping`);
							continue;
						}

						// Get Aloware contact ID
						const mapping = await db.query.contactMappings.findFirst({
							where: eq(contactMappings.ghlContactId, ghlContactId),
						});

						if (mapping?.alowareContactId) {
							validContactIds.push(ghlContactId);
							alowareContactIds.push(mapping.alowareContactId);
						}
					} catch (error) {
						console.error(`[rebuild] Error processing contact ${ghlContactId}:`, error);
						errors++;
					}
				}

				// Update Aloware list with valid contacts
				if (entry.alowareListId && alowareContactIds.length > 0) {
					await updateCallList(entry.alowareListId, { contact_ids: alowareContactIds });
					rebuilt++;
					console.log(`[rebuild] Rebuilt ${entry.agentKey}/${entry.listKey} with ${alowareContactIds.length} contacts`);
				}
			} catch (error) {
				console.error(`[rebuild] Error rebuilding list ${entry.agentKey}/${entry.listKey}:`, error);
				errors++;
			}
		}

		return NextResponse.json({
			rebuilt,
			errors,
			message: `Rebuilt ${rebuilt} list(s) with ${errors} error(s)`,
		});
	} catch (error) {
		console.error("[rebuild] Error:", error);
		return NextResponse.json({
			error: error instanceof Error ? error.message : "Unknown error",
		}, { status: 500 });
	}
}

