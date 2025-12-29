#!/usr/bin/env tsx
/**
 * Test script to add a contact to DF_RAFI_NEW_LEADS list
 * 
 * Usage:
 *   export DATABASE_URL="..." && export ALOWARE_API_TOKEN="..." && tsx scripts/test-list-add.ts [GHL_CONTACT_ID]
 * 
 * If no contact ID provided, will use the first contact found in mappings
 */

import { db } from "../src/server/db";
import { contactMappings } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { getCallList, updateCallList } from "../src/lib/aloware/client";

const LIST_ID = "396726"; // DF_RAFI_NEW_LEADS

async function main() {
	const ghlContactId = process.argv[2];

	let contactId = ghlContactId;

	if (!contactId) {
		console.log("No GHL contact ID provided, searching for existing contact...");
		const mapping = await db.query.contactMappings.findFirst({
			limit: 1,
		});

		if (!mapping?.ghlContactId) {
			console.error("No contacts found in mappings. Please provide a GHL contact ID:");
			console.error("  tsx scripts/test-list-add.ts <GHL_CONTACT_ID>");
			process.exit(1);
		}

		contactId = mapping.ghlContactId;
		console.log(`Using contact ID from mappings: ${contactId}`);
	}

	console.log(`\nTesting add contact to list ${LIST_ID}`);
	console.log(`GHL Contact ID: ${contactId}\n`);

	// Step 1: Find Aloware contact ID
	console.log("Step 1: Finding Aloware contact ID...");
	const mapping = await db.query.contactMappings.findFirst({
		where: eq(contactMappings.ghlContactId, contactId),
	});

	if (!mapping?.alowareContactId) {
		console.error(`❌ No Aloware contact mapping found for GHL contact ${contactId}`);
		console.error("   The contact needs to be synced to Aloware first.");
		process.exit(1);
	}

	const alowareContactId = mapping.alowareContactId;
	console.log(`✅ Found Aloware contact ID: ${alowareContactId}`);

	// Step 2: Get current list state
	console.log("\nStep 2: Fetching current list state...");
	const currentList = await getCallList(LIST_ID);
	
	if (!currentList) {
		console.error(`❌ List ${LIST_ID} not found`);
		process.exit(1);
	}

	console.log(`✅ List found: ${currentList.name}`);
	console.log(`   Current contact count: ${currentList.contact_ids?.length || 0}`);

	const existingIds = currentList.contact_ids || [];
	const contactAlreadyInList = existingIds.includes(alowareContactId);

	if (contactAlreadyInList) {
		console.log(`\n⚠️  Contact is already in the list`);
		console.log(`   Final contact count: ${existingIds.length}`);
		process.exit(0);
	}

	// Step 3: Add contact
	console.log("\nStep 3: Adding contact to list...");
	const newIds = [...new Set([...existingIds, alowareContactId])];

	try {
		const updated = await updateCallList(LIST_ID, { contact_ids: newIds });
		console.log(`✅ Contact added successfully!`);
		console.log(`   Updated contact count: ${updated.contact_ids?.length || 0}`);
		console.log(`\n✅ Test passed! Contact is now in the list.`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`\n❌ Failed to add contact: ${errorMessage}`);
		
		if (errorMessage.includes("405") || errorMessage.includes("Method Not Allowed")) {
			console.error("\n⚠️  PUT method not supported by Aloware API");
			console.error("   The API may not support programmatic list updates.");
			console.error("   You may need to use CSV import or a different endpoint.");
		}
		
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});

