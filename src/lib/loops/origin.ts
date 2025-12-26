/**
 * Detect if a webhook event originated from middleware
 * Prevents infinite sync loops
 */

/**
 * Detect middleware origin markers in payload
 */
export function detectMiddlewareOrigin(
	source: string,
	payload: unknown
): { isOrigin: boolean; originId?: string } {
	if (typeof payload !== "object" || payload === null) {
		return { isOrigin: false };
	}

	const obj = payload as Record<string, unknown>;

	if (source === "ghl") {
		// Check for GHL tags containing middleware marker
		if (obj.tags && Array.isArray(obj.tags)) {
			const tags = obj.tags as unknown[];
			if (tags.some(tag => typeof tag === "string" && tag.includes("SYS:df_middleware_origin"))) {
				// Try to extract origin ID from tags
				const originTag = tags.find(tag => 
					typeof tag === "string" && tag.startsWith("SYS:origin_id:")
				) as string | undefined;
				const originId = originTag?.split(":")[2];
				return { isOrigin: true, originId };
			}
		}

		// Check custom fields
		if (obj.customFields && typeof obj.customFields === "object") {
			const customFields = obj.customFields as Record<string, unknown>;
			if (customFields.SYS_df_middleware_origin || customFields["SYS:df_middleware_origin"]) {
				const originId = customFields.SYS_origin_id || customFields["SYS:origin_id"];
				return { isOrigin: true, originId: originId as string | undefined };
			}
		}
	} else if (source === "aloware") {
		// Check notes/custom fields for middleware markers
		if (obj.notes && typeof obj.notes === "string") {
			if (obj.notes.includes("SYS:df_middleware_origin")) {
				const match = obj.notes.match(/SYS:origin_id:([a-f0-9-]+)/i);
				return { isOrigin: true, originId: match?.[1] };
			}
		}

		// Check external_ids or custom fields
		if (obj.external_ids && typeof obj.external_ids === "object") {
			const externalIds = obj.external_ids as Record<string, unknown>;
			if (externalIds.df_middleware_origin || externalIds["SYS:df_middleware_origin"]) {
				const originId = externalIds.df_middleware_origin_id || externalIds["SYS:origin_id"];
				return { isOrigin: true, originId: originId as string | undefined };
			}
		}
	}

	return { isOrigin: false };
}

