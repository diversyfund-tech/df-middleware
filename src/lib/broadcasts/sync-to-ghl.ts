/**
 * Sync Broadcast Analytics to GHL Custom Objects
 * 
 * Syncs broadcast analytics to GHL Custom Objects using the Custom Objects API.
 * Handles create/update operations with proper error handling and retries.
 */

import { env } from "@/env";
import { ghlRequest } from "@/lib/ghl/client";
import type { BroadcastAnalyticsData } from "./types";

const GHL_API_BASE_URL = env.GHL_BASE_URL || "https://services.leadconnectorhq.com";
const GHL_OBJECT_KEY_WITH_PREFIX = "custom_objects.broadcasts";

interface GHLCustomObject {
	id?: string;
	broadcastId?: string;
	broadcastName?: string;
	channel?: string;
	sentAt?: string;
	recipients?: number;
	sent?: number;
	delivered?: number;
	pending?: number;
	failed?: number;
	responses?: number;
	appointmentsSet?: number;
	deliveryRate?: number;
	responseRate?: number;
	failureRate?: number;
	conversionRate?: number;
	[key: string]: unknown;
}

/**
 * Get GHL API key for Custom Objects operations
 */
function getGHLApiKey(): string {
	const apiKey = env.GHL_API_KEY;
	if (!apiKey) {
		throw new Error("GHL_API_KEY is required for Custom Objects operations");
	}
	return apiKey;
}

/**
 * Find existing Broadcast custom object in GHL by Broadcast ID
 * 
 * Note: GHL does NOT support server-side filtering on custom object records.
 * We must list all records and filter client-side.
 */
async function findBroadcastCustomObject(broadcastId: string): Promise<GHLCustomObject | null> {
	const apiKey = getGHLApiKey();
	const locationId = env.GHL_LOCATION_ID;

	if (!locationId) {
		console.error(`[findBroadcastCustomObject] GHL_LOCATION_ID not configured`);
		return null;
	}

	try {
		// List all records - locationId goes in query param for GET requests
		const url = `${GHL_API_BASE_URL}/objects/${GHL_OBJECT_KEY_WITH_PREFIX}/records?locationId=${locationId}`;
		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Accept": "application/json",
				"Version": "2021-07-28",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			if (errorText.includes("404")) {
				return null;
			}
			console.error(`[findBroadcastCustomObject] GET error (${response.status}):`, errorText);
			throw new Error(`GHL API error (${response.status}): ${errorText}`);
		}

		const result = await response.json();
		const records = result.data || result.records || result.items || [];

		// Filter client-side by broadcast_id
		const matchingRecord = records.find((record: any) => {
			const recordBroadcastId = record.properties?.broadcast_id || record.broadcast_id;
			return recordBroadcastId === broadcastId;
		});

		return matchingRecord || null;
	} catch (error: any) {
		if (error.message.includes('404')) {
			return null;
		}
		console.error(`[findBroadcastCustomObject] Error:`, error.message);
		return null;
	}
}

/**
 * Create or update Broadcast custom object in GHL
 */
export async function syncBroadcastAnalyticsToGHL(
	broadcastId: string,
	analytics: BroadcastAnalyticsData
): Promise<void> {
	const apiKey = getGHLApiKey();
	const locationId = env.GHL_LOCATION_ID;

	if (!locationId) {
		throw new Error("GHL_LOCATION_ID is not configured");
	}

	// Find existing record first
	const existing = await findBroadcastCustomObject(broadcastId);

	// Build payload with locationId at top-level (required for Private Integrations POST)
	// Rates should be decimals (0.06 for 6%), not percentages (6.0)
	const payload = {
		locationId: locationId, // Top-level, required for Private Integrations POST
		properties: {
			broadcast_id: broadcastId,
			broadcast_name: analytics.broadcastName,
			channel: analytics.channel,
			sent_at: analytics.sentAt || "",
			recipients: analytics.recipients,
			sent: analytics.sent,
			delivered: analytics.delivered,
			pending: analytics.pending,
			failed: analytics.failed,
			responses: analytics.responses,
			appointments_set: analytics.appointmentsSet,
			// Rates as decimals (0.06 for 6%), not percentages
			delivery_rate: analytics.deliveryRate / 100,
			response_rate: analytics.responseRate / 100,
			failure_rate: analytics.failureRate / 100,
			conversion_rate: analytics.conversionRate / 100,
		},
	};

	const baseEndpoint = `/objects/${GHL_OBJECT_KEY_WITH_PREFIX}/records`;

	const headers: Record<string, string> = {
		"Authorization": `Bearer ${apiKey}`,
		"Accept": "application/json",
		"Version": "2021-07-28",
		"Content-Type": "application/json",
	};

	if (existing?.id) {
		// Update existing record - for PUT, locationId goes in query string, not body
		const { locationId: _, ...putPayload } = payload;
		const url = `${GHL_API_BASE_URL}${baseEndpoint}/${existing.id}?locationId=${locationId}`;
		const response = await fetch(url, {
			method: "PUT",
			headers,
			body: JSON.stringify(putPayload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[syncBroadcastAnalyticsToGHL] PUT error (${response.status}):`, errorText);
			console.error(`[syncBroadcastAnalyticsToGHL] PUT URL:`, url);
			console.error(`[syncBroadcastAnalyticsToGHL] PUT payload:`, JSON.stringify(putPayload, null, 2));
			throw new Error(`GHL API error (${response.status}): ${errorText}`);
		}

		console.log(`[syncBroadcastAnalyticsToGHL] Successfully updated broadcast ${broadcastId} in GHL`);
	} else {
		// Create new record - locationId in body for POST
		const url = `${GHL_API_BASE_URL}${baseEndpoint}`;
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorText = await response.text();

			// Check if this is a duplicate record error - extract conflictingRecordId and update instead
			try {
				const errorJson = JSON.parse(errorText);
				if (errorJson.errors && Array.isArray(errorJson.errors)) {
					const duplicateError = errorJson.errors.find((e: any) =>
						e.errorCode === "duplicate_record" && e.fieldKey === "custom_objects.broadcasts.broadcast_id"
					);
					const conflictError = errorJson.errors.find((e: any) =>
						e.errorCode === "primary_property_conflict" || e.errorCode === "duplicate_record"
					);

					const recordId = duplicateError?.conflictingRecordId || conflictError?.conflictingRecordId;
					if (recordId) {
						console.log(`[syncBroadcastAnalyticsToGHL] Record exists (${recordId}), updating instead of creating`);
						// Retry as PUT - use locationId in query string for PUT
						const { locationId: _, ...updatePayloadWithoutLocationId } = payload;
						const updateUrl = `${GHL_API_BASE_URL}${baseEndpoint}/${recordId}?locationId=${locationId}`;
						const updateResponse = await fetch(updateUrl, {
							method: "PUT",
							headers,
							body: JSON.stringify(updatePayloadWithoutLocationId),
						});

						if (updateResponse.ok) {
							console.log(`[syncBroadcastAnalyticsToGHL] Successfully updated record ${recordId}`);
							return;
						} else {
							const updateErrorText = await updateResponse.text();
							console.error(`[syncBroadcastAnalyticsToGHL] PUT error (${updateResponse.status}):`, updateErrorText);
							throw new Error(`GHL API error (${updateResponse.status}): ${updateErrorText}`);
						}
					}
				}
			} catch (parseError) {
				// Not JSON or parsing failed, continue with original error
			}

			console.error(`[syncBroadcastAnalyticsToGHL] POST error (${response.status}):`, errorText);
			console.error(`[syncBroadcastAnalyticsToGHL] URL:`, url);
			throw new Error(`GHL API error (${response.status}): ${errorText}`);
		}

		console.log(`[syncBroadcastAnalyticsToGHL] Successfully created broadcast ${broadcastId} in GHL`);
	}
}


