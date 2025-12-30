import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const VERITY_DB_URL = process.env.VERITY_DATABASE_URL || "postgresql://neondb_owner:LYtOTMa8rk5p@ep-late-shape-a6nsw636-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export async function GET(req: NextRequest) {
	try {
		const client = postgres(VERITY_DB_URL);
		
		// Test connection
		const testResult = await client`SELECT 1 as test`;
		console.log("[verify-verity-db] Connection test:", testResult);

		// Check contacts table
		const contactsCount = await client`SELECT COUNT(*) as count FROM contacts`;
		const contactsSample = await client`SELECT id, phone_e164, email, first_name, last_name FROM contacts LIMIT 5`;

		// Check person table
		const personCount = await client`SELECT COUNT(*) as count FROM person`;
		const personSample = await client`SELECT id, phone_number, email_address, first_name, last_name FROM person LIMIT 5`;

		// Check for the specific contact ID
		const specificContact = await client`
			SELECT id, phone_e164, email, first_name, last_name 
			FROM contacts 
			WHERE id = '09550cc3-231e-4daa-9c5c-7450e4da4eca'
		`;
		
		const specificPerson = await client`
			SELECT id, phone_number, email_address, first_name, last_name 
			FROM person 
			WHERE id = '09550cc3-231e-4daa-9c5c-7450e4da4eca'
		`;

		await client.end();

		return NextResponse.json({
			success: true,
			databaseConnected: true,
			contactsTable: {
				count: contactsCount[0]?.count || 0,
				sample: contactsSample,
			},
			personTable: {
				count: personCount[0]?.count || 0,
				sample: personSample,
			},
			specificContactLookup: {
				inContacts: specificContact.length > 0 ? specificContact[0] : null,
				inPerson: specificPerson.length > 0 ? specificPerson[0] : null,
			},
		});
	} catch (error) {
		console.error("[verify-verity-db] Error:", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json({ 
			success: false, 
			error: message,
			stack: error instanceof Error ? error.stack : undefined
		}, { status: 500 });
	}
}


