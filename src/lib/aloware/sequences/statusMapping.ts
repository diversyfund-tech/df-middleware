import { env } from "@/env";

interface StatusMapping {
	[status: string]: string | { sequence_id: string; optional?: boolean };
}

/**
 * Parse the ALOWARE_STATUS_TO_SEQUENCE environment variable
 * Returns the mapping object or empty object on error
 */
function parseStatusMapping(): StatusMapping {
	try {
		const mappingStr = env.ALOWARE_STATUS_TO_SEQUENCE;
		if (!mappingStr || mappingStr === "{}") {
			return {};
		}
		return JSON.parse(mappingStr) as StatusMapping;
	} catch (error) {
		console.error("[statusMapping] Error parsing ALOWARE_STATUS_TO_SEQUENCE:", error);
		return {};
	}
}

/**
 * Get sequence ID for a given status value
 * Returns null if status not found or is optional
 */
export function getSequenceIdForStatus(status: string): string | null {
	if (!status || status.trim() === "") {
		return null;
	}

	const mapping = parseStatusMapping();
	const statusValue = mapping[status];

	if (!statusValue) {
		return null;
	}

	// Handle both string and object formats
	if (typeof statusValue === "string") {
		return statusValue;
	}

	if (typeof statusValue === "object" && statusValue.sequence_id) {
		return statusValue.sequence_id;
	}

	return null;
}

/**
 * Check if a status is marked as optional in the config
 */
export function isStatusOptional(status: string): boolean {
	if (!status || status.trim() === "") {
		return false;
	}

	const mapping = parseStatusMapping();
	const statusValue = mapping[status];

	if (!statusValue) {
		return false;
	}

	// If it's an object with optional flag, return that
	if (typeof statusValue === "object" && statusValue.optional !== undefined) {
		return statusValue.optional === true;
	}

	return false;
}

/**
 * Get all configured status values
 */
export function getAllStatuses(): string[] {
	const mapping = parseStatusMapping();
	return Object.keys(mapping);
}


