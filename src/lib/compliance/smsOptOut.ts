/**
 * SMS Opt-Out Compliance Helpers
 */

/**
 * Keywords that indicate STOP request
 */
const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPT-OUT", "OPTOUT"];

/**
 * Keywords that indicate HELP request
 */
const HELP_KEYWORDS = ["HELP", "INFO", "ASSIST"];

/**
 * Check if message body contains STOP keywords
 */
export function isStop(body: string): boolean {
	const normalized = normalizeBody(body);
	return STOP_KEYWORDS.some(keyword => normalized.includes(keyword));
}

/**
 * Check if message body contains HELP keywords
 */
export function isHelp(body: string): boolean {
	const normalized = normalizeBody(body);
	return HELP_KEYWORDS.some(keyword => normalized.includes(keyword));
}

/**
 * Normalize message body for comparison
 * - Convert to uppercase
 * - Remove extra whitespace
 * - Trim
 */
export function normalizeBody(body: string): string {
	return body.toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Error thrown when attempting to send to opted-out number
 */
export class OptedOutError extends Error {
	constructor(phoneNumber: string) {
		super(`Phone number ${phoneNumber} has opted out of SMS`);
		this.name = "OptedOutError";
	}
}

