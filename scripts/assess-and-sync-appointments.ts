/**
 * Assess and Sync Appointments for Specific Contacts
 * 
 * This script:
 * 1. Searches for contacts by name in GHL
 * 2. Checks if they have appointments
 * 3. Checks if their conversations have been reviewed
 * 4. Assesses appointments for contacts with unreviewed conversations
 * 5. Confirms appointments by analyzing appointment data
 * 6. Syncs confirmed appointments to Verity
 */

import { ghlRequest, getContact, searchContact } from "../src/lib/ghl/client";
import { getAppointment, getCalendarEvents } from "../src/lib/workflows/appointments/ghl-appointment";
import { syncGHLAppointmentToVerity } from "../src/lib/sync/appointment-sync";
import { getVerityDb } from "../src/lib/broadcasts/verity-db";
import { env } from "../src/env";
import type { GHLContact, GHLAppointment } from "../src/lib/ghl/types";

interface ContactAssessment {
	name: string;
	ghlContact: GHLContact | null;
	appointments: GHLAppointment[];
	conversationsReviewed: boolean;
	needsAssessment: boolean;
	confirmedAppointments: GHLAppointment[];
	syncedCount: number;
	errors: string[];
}

const CONTACT_NAMES = [
	"Adam Schaefer",
	"Alejandro Hernandez",
	"Andrew Clayton",
	"Arockiaraj Swaminathan",
	"Benjamin Lins",
	"Bhaskara",
	"Brian Bertrand",
	"Brian Martin",
	"Bryan Hogan",
	"Carol Cho",
	"Carolle Letang",
	"Charles Cook",
	"Charles W. Bright",
	"David Greenberg",
	"DeAndre Solomon",
	"Deandra Freeney",
	"Diana Stinnett",
	"Dickson Njoki",
	"Dimpu Aravind",
	"Dominik Winfree",
	"Donald Crabb",
	"Elliot Vasquez",
	"Eumika Wiggins",
	"Francine Shaw",
	"Goldie Jones",
	"Harshal Patankar",
	"Jacob Linder",
	"Jeana Auger",
	"Jeff Hubbard",
	"Jeoffrey De Waele",
	"Jodeh Nassar",
	"John Galvan",
	"John Zimmerman",
	"Judd Payne",
	"Julie Sumwalt",
	"Julius Burris",
	"Kelly Garrett",
	"Ken Hui",
	"Kevin Shah",
	"Klaus Pfeffer",
	"Linda D. Fruster",
	"Matthew Klein",
	"Melvin Ramos",
	"Mirwais Noori",
	"Mitchell Carter",
	"Mona Pierre-Louis",
	"Nadine Spring",
	"Norris Russell Jr",
	"Peter Botros",
	"Preston Cooper",
	"Ramesh Cheedarala",
	"Robert Patrick",
	"Robert Wallace",
	"Saman Fattahi",
	"Sana Rezai",
	"Shannon Sullivan",
	"Shanique Lindsay",
	"Shawn Baker",
	"Svitlana Soltysyak",
	"Terfa Nyamor",
	"Thomas Oblak",
	"Valerie Koelling",
	"Vida Tobi Kanter",
	"Virgil Aldridge",
	"Yazid Shahid",
	"Zeeshan Samad",
];

/**
 * Search for a contact by name in GHL
 */
async function searchContactByName(name: string): Promise<GHLContact | null> {
	try {
		// Try searching by full name first
		const fullNameResult = await ghlRequest<{ contacts?: GHLContact[] }>(
			`/contacts?query=${encodeURIComponent(name)}`
		);

		if (fullNameResult.contacts && fullNameResult.contacts.length > 0) {
			// Find exact match by comparing names
			const exactMatch = fullNameResult.contacts.find(contact => {
				const contactName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
				return contactName.toLowerCase() === name.toLowerCase();
			});

			if (exactMatch) {
				return exactMatch;
			}

			// Return first result if no exact match
			return fullNameResult.contacts[0];
		}

		// Try searching by first name and last name separately
		const nameParts = name.trim().split(/\s+/);
		if (nameParts.length >= 2) {
			const firstName = nameParts[0];
			const lastName = nameParts.slice(1).join(" ");

			const firstNameResult = await ghlRequest<{ contacts?: GHLContact[] }>(
				`/contacts?query=${encodeURIComponent(firstName)}`
			);

			if (firstNameResult.contacts && firstNameResult.contacts.length > 0) {
				const match = firstNameResult.contacts.find(contact => {
					const contactLastName = (contact.lastName || "").toLowerCase();
					return contactLastName === lastName.toLowerCase();
				});

				if (match) {
					return match;
				}
			}
		}

		return null;
	} catch (error) {
		console.error(`[searchContactByName] Error searching for ${name}:`, error);
		return null;
	}
}

/**
 * Get appointments for a contact
 */
async function getContactAppointments(contactId: string): Promise<GHLAppointment[]> {
	try {
		// Try to get appointments directly for the contact via GHL API
		// First, try the contact-specific endpoint if it exists
		try {
			const contactAppointments = await ghlRequest<{ appointments?: GHLAppointment[] }>(
				`/contacts/${contactId}/appointments`
			);
			if (contactAppointments.appointments && contactAppointments.appointments.length > 0) {
				return contactAppointments.appointments;
			}
		} catch {
			// Endpoint might not exist, fall back to calendar events
		}

		// Fallback: Get appointments from calendar and filter by contact
		const now = new Date();
		const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
		const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

		const appointments = await getCalendarEvents(
			startDate.toISOString(),
			endDate.toISOString()
		);

		// Filter appointments for this contact
		return appointments.filter(apt => apt.contactId === contactId);
	} catch (error) {
		console.error(`[getContactAppointments] Error getting appointments for contact ${contactId}:`, error);
		return [];
	}
}

/**
 * Check if conversations have been reviewed
 * A conversation is considered reviewed if:
 * - It has no unread messages, OR
 * - The last message was sent more than 24 hours ago (assumed reviewed)
 */
async function checkConversationsReviewed(contactId: string): Promise<boolean> {
	try {
		// Get conversations for this contact
		const conversations = await ghlRequest<{ conversations?: Array<{ id: string; unreadCount?: number; lastMessageAt?: string }> }>(
			`/conversations?contactId=${contactId}`
		);

		if (!conversations.conversations || conversations.conversations.length === 0) {
			// No conversations = considered reviewed (nothing to review)
			return true;
		}

		// Check if any conversation has unread messages
		const hasUnread = conversations.conversations.some(conv => {
			const unreadCount = conv.unreadCount || 0;
			return unreadCount > 0;
		});

		if (hasUnread) {
			return false;
		}

		// Check if last message was recent (within 24 hours) - might need review
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const hasRecentMessages = conversations.conversations.some(conv => {
			if (!conv.lastMessageAt) return false;
			const lastMessageDate = new Date(conv.lastMessageAt);
			return lastMessageDate > oneDayAgo;
		});

		// If there are recent messages but no unread, assume reviewed
		return true;
	} catch (error) {
		console.error(`[checkConversationsReviewed] Error checking conversations for contact ${contactId}:`, error);
		// On error, assume reviewed to avoid blocking
		return true;
	}
}

/**
 * Assess appointment to determine if it should be confirmed
 * An appointment is confirmed if:
 * - It has a valid status (not cancelled)
 * - It has a startTime in the future or recent past (within 7 days)
 * - It has a title/notes indicating it's a real appointment
 */
function assessAppointment(appointment: GHLAppointment): boolean {
	// Check status - exclude cancelled appointments
	const status = (appointment.status || "").toLowerCase();
	if (status.includes("cancel") || status.includes("no-show")) {
		return false;
	}

	// Check if appointment is in the future or recent past (within 7 days)
	const startTime = new Date(appointment.startTime);
	const now = new Date();
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

	if (startTime < sevenDaysAgo) {
		// Too old, probably already happened
		return false;
	}

	if (startTime > sevenDaysFromNow) {
		// Too far in the future, might not be confirmed yet
		return false;
	}

	// Check if appointment has meaningful content
	const title = (appointment.title || "").trim();
	const notes = (appointment.notes || "").trim();

	if (!title && !notes) {
		// No title or notes, might be a placeholder
		return false;
	}

	// If it has a title or notes and is within the time window, consider it confirmed
	return true;
}

/**
 * Check if appointment is already synced to Verity
 */
async function isAppointmentSynced(appointmentId: string): Promise<boolean> {
	try {
		const verityDb = getVerityDb();
		const result = await verityDb`
			SELECT COUNT(*)::int as count
			FROM leads
			WHERE ghl_appointment_id = ${appointmentId}
		`;

		return (result[0]?.count || 0) > 0;
	} catch (error) {
		console.error(`[isAppointmentSynced] Error checking sync status for appointment ${appointmentId}:`, error);
		return false;
	}
}

/**
 * Assess a single contact
 */
async function assessContact(name: string): Promise<ContactAssessment> {
	const assessment: ContactAssessment = {
		name,
		ghlContact: null,
		appointments: [],
		conversationsReviewed: true,
		needsAssessment: false,
		confirmedAppointments: [],
		syncedCount: 0,
		errors: [],
	};

	try {
		// 1. Search for contact in GHL
		console.log(`\n[${name}] Searching for contact...`);
		const contact = await searchContactByName(name);
		if (!contact) {
			assessment.errors.push("Contact not found in GHL");
			return assessment;
		}
		assessment.ghlContact = contact;
		console.log(`[${name}] Found contact: ${contact.id} (${contact.firstName} ${contact.lastName})`);

		// 2. Get appointments for this contact
		console.log(`[${name}] Getting appointments...`);
		const appointments = await getContactAppointments(contact.id);
		assessment.appointments = appointments;
		console.log(`[${name}] Found ${appointments.length} appointments`);

		if (appointments.length === 0) {
			assessment.errors.push("No appointments found");
			return assessment;
		}

		// 3. Check if conversations have been reviewed
		console.log(`[${name}] Checking conversation review status...`);
		const reviewed = await checkConversationsReviewed(contact.id);
		assessment.conversationsReviewed = reviewed;
		console.log(`[${name}] Conversations reviewed: ${reviewed}`);

		// 4. If conversations haven't been reviewed, assess appointments
		if (!reviewed) {
			assessment.needsAssessment = true;
			console.log(`[${name}] Conversations not reviewed - assessing appointments...`);

			// Assess each appointment
			for (const appointment of appointments) {
				const isConfirmed = assessAppointment(appointment);
				if (isConfirmed) {
					assessment.confirmedAppointments.push(appointment);
					console.log(`[${name}] Confirmed appointment: ${appointment.id} - ${appointment.title} (${appointment.startTime})`);
				}
			}
		} else {
			// If reviewed, all appointments are considered confirmed
			assessment.confirmedAppointments = appointments;
			console.log(`[${name}] Conversations reviewed - all appointments confirmed`);
		}

		// 5. Sync confirmed appointments to Verity
		console.log(`[${name}] Syncing ${assessment.confirmedAppointments.length} confirmed appointments...`);
		for (const appointment of assessment.confirmedAppointments) {
			try {
				// Check if already synced
				const alreadySynced = await isAppointmentSynced(appointment.id);
				if (alreadySynced) {
					console.log(`[${name}] Appointment ${appointment.id} already synced, skipping`);
					assessment.syncedCount++;
					continue;
				}

				// Sync appointment
				await syncGHLAppointmentToVerity(appointment.id, contact.id, `assess-${name}-${Date.now()}`);
				assessment.syncedCount++;
				console.log(`[${name}] Synced appointment ${appointment.id} to Verity`);
			} catch (syncError) {
				const errorMsg = syncError instanceof Error ? syncError.message : String(syncError);
				assessment.errors.push(`Failed to sync appointment ${appointment.id}: ${errorMsg}`);
				console.error(`[${name}] Error syncing appointment ${appointment.id}:`, syncError);
			}
		}

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		assessment.errors.push(`Assessment error: ${errorMsg}`);
		console.error(`[${name}] Error during assessment:`, error);
	}

	return assessment;
}

/**
 * Main function
 */
async function main() {
	console.log("=== Appointment Assessment and Sync ===\n");
	console.log(`Processing ${CONTACT_NAMES.length} contacts...\n`);

	const results: ContactAssessment[] = [];
	let processed = 0;

	for (const name of CONTACT_NAMES) {
		processed++;
		console.log(`\n[${processed}/${CONTACT_NAMES.length}] Processing: ${name}`);
		
		const assessment = await assessContact(name);
		results.push(assessment);

		// Add a small delay to avoid rate limiting
		await new Promise(resolve => setTimeout(resolve, 500));
	}

	// Print summary
	console.log("\n\n=== SUMMARY ===\n");
	
	const found = results.filter(r => r.ghlContact !== null).length;
	const withAppointments = results.filter(r => r.appointments.length > 0).length;
	const needsAssessment = results.filter(r => r.needsAssessment).length;
	const totalConfirmed = results.reduce((sum, r) => sum + r.confirmedAppointments.length, 0);
	const totalSynced = results.reduce((sum, r) => sum + r.syncedCount, 0);
	const withErrors = results.filter(r => r.errors.length > 0).length;

	console.log(`Contacts found: ${found}/${CONTACT_NAMES.length}`);
	console.log(`Contacts with appointments: ${withAppointments}`);
	console.log(`Contacts needing assessment: ${needsAssessment}`);
	console.log(`Total confirmed appointments: ${totalConfirmed}`);
	console.log(`Total synced appointments: ${totalSynced}`);
	console.log(`Contacts with errors: ${withErrors}`);

	// Print detailed results
	console.log("\n=== DETAILED RESULTS ===\n");
	for (const result of results) {
		if (result.ghlContact) {
			console.log(`\n${result.name}:`);
			console.log(`  Contact ID: ${result.ghlContact.id}`);
			console.log(`  Appointments: ${result.appointments.length}`);
			console.log(`  Conversations Reviewed: ${result.conversationsReviewed}`);
			console.log(`  Needs Assessment: ${result.needsAssessment}`);
			console.log(`  Confirmed Appointments: ${result.confirmedAppointments.length}`);
			console.log(`  Synced: ${result.syncedCount}`);
			
			if (result.confirmedAppointments.length > 0) {
				console.log(`  Confirmed Appointment Details:`);
				for (const apt of result.confirmedAppointments) {
					console.log(`    - ${apt.id}: ${apt.title} (${apt.startTime})`);
				}
			}
			
			if (result.errors.length > 0) {
				console.log(`  Errors:`);
				for (const error of result.errors) {
					console.log(`    - ${error}`);
				}
			}
		} else {
			console.log(`\n${result.name}: NOT FOUND`);
			if (result.errors.length > 0) {
				for (const error of result.errors) {
					console.log(`  - ${error}`);
				}
			}
		}
	}
}

// Run if executed directly
if (require.main === module) {
	main()
		.then(() => {
			console.log("\n\n=== COMPLETE ===");
			process.exit(0);
		})
		.catch(error => {
			console.error("\n\n=== ERROR ===");
			console.error(error);
			process.exit(1);
		});
}

export { assessContact, CONTACT_NAMES };
