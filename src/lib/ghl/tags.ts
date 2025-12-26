/**
 * Extract tag name from GHL webhook payload
 * Defensively handles various payload structures
 */
export function extractTagNameFromGhlPayload(payload: unknown): string | null {
	if (typeof payload !== "object" || payload === null) {
		return null;
	}

	const obj = payload as Record<string, unknown>;

	// Try direct tag fields
	if (typeof obj.tag === "string" && obj.tag) {
		return obj.tag;
	}
	if (typeof obj.tagName === "string" && obj.tagName) {
		return obj.tagName;
	}
	if (typeof obj.name === "string" && obj.name) {
		return obj.name;
	}

	// Try nested structures
	if (obj.body && typeof obj.body === "object" && obj.body !== null) {
		const body = obj.body as Record<string, unknown>;
		if (typeof body.tag === "string" && body.tag) {
			return body.tag;
		}
		if (typeof body.tagName === "string" && body.tagName) {
			return body.tagName;
		}
		if (typeof body.name === "string" && body.name) {
			return body.name;
		}
	}

	if (obj.data && typeof obj.data === "object" && obj.data !== null) {
		const data = obj.data as Record<string, unknown>;
		if (typeof data.tag === "string" && data.tag) {
			return data.tag;
		}
		if (typeof data.tagName === "string" && data.tagName) {
			return data.tagName;
		}
		if (typeof data.name === "string" && data.name) {
			return data.name;
		}
	}

	// Try tags array (first tag)
	if (Array.isArray(obj.tags) && obj.tags.length > 0) {
		const firstTag = obj.tags[0];
		if (typeof firstTag === "string") {
			return firstTag;
		}
		if (typeof firstTag === "object" && firstTag !== null) {
			const tagObj = firstTag as Record<string, unknown>;
			if (typeof tagObj.name === "string") {
				return tagObj.name;
			}
		}
	}

	// Try nested tags array
	if (obj.body && typeof obj.body === "object" && obj.body !== null) {
		const body = obj.body as Record<string, unknown>;
		if (Array.isArray(body.tags) && body.tags.length > 0) {
			const firstTag = body.tags[0];
			if (typeof firstTag === "string") {
				return firstTag;
			}
		}
	}

	console.warn("[ghl/tags] Could not extract tag name from payload:", {
		hasTag: "tag" in obj,
		hasTagName: "tagName" in obj,
		hasName: "name" in obj,
		hasBody: "body" in obj,
		hasData: "data" in obj,
	});

	return null;
}

