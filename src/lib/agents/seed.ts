import { db } from "@/server/db";
import { agentDirectory } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getUsers as getGhlUsers } from "@/lib/ghl/client";
import { getUsers as getAlowareUsers } from "@/lib/aloware/client";

/**
 * Find GHL user by name (case-insensitive partial match)
 */
function findGhlUserByName(users: Array<{ id?: string; email?: string; name?: string; [key: string]: unknown }>, name: string): { id?: string; email?: string } | null {
	const nameLower = name.toLowerCase();
	for (const user of users) {
		const userName = String(user.name || "").toLowerCase();
		const userEmail = String(user.email || "").toLowerCase();
		if (userName.includes(nameLower) || userEmail.includes(nameLower)) {
			return { id: user.id, email: user.email };
		}
	}
	return null;
}

/**
 * Find Aloware user by name (case-insensitive partial match)
 */
function findAlowareUserByName(users: Array<{ id?: string; email?: string; name?: string; [key: string]: unknown }>, name: string): { id?: string } | null {
	const nameLower = name.toLowerCase();
	for (const user of users) {
		const userName = String(user.name || "").toLowerCase();
		const userEmail = String(user.email || "").toLowerCase();
		if (userName.includes(nameLower) || userEmail.includes(nameLower)) {
			return { id: user.id };
		}
	}
	return null;
}

/**
 * Seed agent directory with default entries for CHRIS, RAFI, UNASSIGNED
 * Automatically fetches owner/user information from GHL and Aloware APIs
 * Can be called on startup or via admin endpoint
 */
export async function seedAgentDirectory(): Promise<number> {
	let seeded = 0;

	// Fetch users from both APIs
	let ghlUsers: Array<{ id?: string; email?: string; name?: string; [key: string]: unknown }> = [];
	let alowareUsers: Array<{ id?: string; email?: string; name?: string; [key: string]: unknown }> = [];

	try {
		ghlUsers = await getGhlUsers();
		console.log(`[seedAgentDirectory] Fetched ${ghlUsers.length} users from GHL`);
	} catch (error) {
		console.warn("[seedAgentDirectory] Could not fetch GHL users:", error);
	}

	try {
		alowareUsers = await getAlowareUsers();
		console.log(`[seedAgentDirectory] Fetched ${alowareUsers.length} users from Aloware`);
	} catch (error) {
		console.warn("[seedAgentDirectory] Could not fetch Aloware users:", error);
	}

	const defaultAgents = [
		{
			agentKey: "CHRIS",
			displayName: "Chris",
			ghlAssignedAgentFieldValue: "Chris",
			requiredTag: "Owner: Chris",
			isActive: true,
		},
		{
			agentKey: "RAFI",
			displayName: "Rafi",
			ghlAssignedAgentFieldValue: "Rafi",
			requiredTag: "Owner: Rafi",
			isActive: true,
		},
		{
			agentKey: "UNASSIGNED",
			displayName: "Unassigned",
			isActive: true,
		},
	];

	for (const agent of defaultAgents) {
		try {
			// Try to find GHL owner/user for Chris and Rafi
			let ghlOwnerId: string | undefined;
			let ghlOwnerEmail: string | undefined;
			let alowareUserId: string | undefined;

			if (agent.agentKey !== "UNASSIGNED") {
				const ghlUser = findGhlUserByName(ghlUsers, agent.displayName);
				if (ghlUser) {
					ghlOwnerId = ghlUser.id;
					ghlOwnerEmail = ghlUser.email;
					console.log(`[seedAgentDirectory] Found GHL user for ${agent.displayName}: id=${ghlOwnerId}, email=${ghlOwnerEmail}`);
				}

				const alowareUser = findAlowareUserByName(alowareUsers, agent.displayName);
				if (alowareUser) {
					alowareUserId = alowareUser.id;
					console.log(`[seedAgentDirectory] Found Aloware user for ${agent.displayName}: id=${alowareUserId}`);
				}
			}

			// Check if agent already exists
			const existing = await db.query.agentDirectory.findFirst({
				where: eq(agentDirectory.agentKey, agent.agentKey),
			});

			if (existing) {
				// Update existing agent (merge with fetched user info, preserve existing values if new ones are missing)
				await db
					.update(agentDirectory)
					.set({
						displayName: agent.displayName,
						ghlOwnerId: ghlOwnerId || existing.ghlOwnerId || null,
						ghlOwnerEmail: ghlOwnerEmail || existing.ghlOwnerEmail || null,
						ghlAssignedAgentFieldValue: agent.ghlAssignedAgentFieldValue || existing.ghlAssignedAgentFieldValue || null,
						requiredTag: agent.requiredTag || existing.requiredTag || null,
						alowareUserId: alowareUserId || existing.alowareUserId || null,
						isActive: agent.isActive,
						updatedAt: new Date(),
					})
					.where(eq(agentDirectory.agentKey, agent.agentKey));
				console.log(`[seedAgentDirectory] Updated agent ${agent.agentKey}`);
			} else {
				// Insert new agent with fetched user info
				await db.insert(agentDirectory).values({
					...agent,
					ghlOwnerId: ghlOwnerId || null,
					ghlOwnerEmail: ghlOwnerEmail || null,
					alowareUserId: alowareUserId || null,
				});
				seeded++;
				console.log(`[seedAgentDirectory] Created agent ${agent.agentKey}`);
			}
		} catch (error) {
			console.error(`[seedAgentDirectory] Error seeding agent ${agent.agentKey}:`, error);
			// Continue with other agents
		}
	}

	return seeded;
}

