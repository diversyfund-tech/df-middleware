import type { CanonicalContact } from "./rules";

/**
 * Decision record for audit trail
 */
export interface Decision {
	field: string;
	value: unknown;
	source: "ghl" | "aloware" | "merged";
	reason: string;
}

/**
 * Merge two contacts using field-level rules
 * Returns merged contact and decisions array for audit
 */
export function mergeContacts(
	ghl: CanonicalContact,
	aloware: CanonicalContact
): { merged: CanonicalContact; decisions: Decision[] } {
	const decisions: Decision[] = [];
	const merged: CanonicalContact = {
		// source is not set for merged contacts (it's a combination)
	};

	// Phone: never overwrite once set unless new is E.164-valid and old is not
	if (ghl.phone && aloware.phone) {
		const ghlIsE164 = /^\+[1-9]\d{1,14}$/.test(ghl.phone);
		const alowareIsE164 = /^\+[1-9]\d{1,14}$/.test(aloware.phone);
		
		if (ghlIsE164 && !alowareIsE164) {
			merged.phone = ghl.phone;
			decisions.push({ field: "phone", value: ghl.phone, source: "ghl", reason: "E.164 valid" });
		} else if (alowareIsE164 && !ghlIsE164) {
			merged.phone = aloware.phone;
			decisions.push({ field: "phone", value: aloware.phone, source: "aloware", reason: "E.164 valid" });
		} else {
			merged.phone = ghl.phone || aloware.phone;
			decisions.push({ field: "phone", value: merged.phone, source: ghl.phone ? "ghl" : "aloware", reason: "first available" });
		}
	} else {
		merged.phone = ghl.phone || aloware.phone;
		if (merged.phone) {
			decisions.push({ field: "phone", value: merged.phone, source: ghl.phone ? "ghl" : "aloware", reason: "only source" });
		}
	}

	// Email: prefer non-empty; if both exist and differ → keep GHL but record conflict
	if (ghl.email && aloware.email) {
		if (ghl.email.toLowerCase() === aloware.email.toLowerCase()) {
			merged.email = ghl.email;
			decisions.push({ field: "email", value: ghl.email, source: "ghl", reason: "match" });
		} else {
			merged.email = ghl.email;
			decisions.push({ field: "email", value: ghl.email, source: "ghl", reason: "conflict - prefer GHL" });
		}
	} else {
		merged.email = ghl.email || aloware.email;
		if (merged.email) {
			decisions.push({ field: "email", value: merged.email, source: ghl.email ? "ghl" : "aloware", reason: "only source" });
		}
	}

	// Name: prefer longer non-empty string
	const ghlName = `${ghl.firstName || ""} ${ghl.lastName || ""}`.trim();
	const alowareName = `${aloware.firstName || ""} ${aloware.lastName || ""}`.trim();
	
	if (ghlName && alowareName) {
		if (ghlName.length >= alowareName.length) {
			merged.firstName = ghl.firstName;
			merged.lastName = ghl.lastName;
			decisions.push({ field: "name", value: ghlName, source: "ghl", reason: "longer" });
		} else {
			merged.firstName = aloware.firstName;
			merged.lastName = aloware.lastName;
			decisions.push({ field: "name", value: alowareName, source: "aloware", reason: "longer" });
		}
	} else {
		merged.firstName = ghl.firstName || aloware.firstName;
		merged.lastName = ghl.lastName || aloware.lastName;
		if (merged.firstName || merged.lastName) {
			decisions.push({ 
				field: "name", 
				value: `${merged.firstName || ""} ${merged.lastName || ""}`.trim(), 
				source: ghlName ? "ghl" : "aloware", 
				reason: "only source" 
			});
		}
	}

	// Timezone: prefer GHL
	merged.timezone = ghl.timezone || aloware.timezone;
	if (merged.timezone) {
		decisions.push({ 
			field: "timezone", 
			value: merged.timezone, 
			source: ghl.timezone ? "ghl" : "aloware", 
			reason: ghl.timezone ? "prefer GHL" : "only source" 
		});
	}

	// Address: prefer GHL unless missing
	if (ghl.address && Object.keys(ghl.address).length > 0) {
		merged.address = ghl.address;
		decisions.push({ field: "address", value: ghl.address, source: "ghl", reason: "prefer GHL" });
	} else if (aloware.address && Object.keys(aloware.address).length > 0) {
		merged.address = aloware.address;
		decisions.push({ field: "address", value: aloware.address, source: "aloware", reason: "GHL missing" });
	}

	// Tags: union + de-dupe; preserve SYS: prefixed tags
	const ghlTags = ghl.tags || [];
	const alowareTags = aloware.tags || [];
	const allTags = [...new Set([...ghlTags, ...alowareTags])];
	
	// Separate SYS tags (never remove) and regular tags
	const sysTags = allTags.filter(tag => tag.startsWith("SYS:"));
	const regularTags = allTags.filter(tag => !tag.startsWith("SYS:"));
	
	merged.tags = [...sysTags, ...regularTags];
	if (merged.tags.length > 0) {
		decisions.push({ field: "tags", value: merged.tags, source: "merged", reason: "union + dedupe" });
	}

	// Custom fields: merge (GHL takes precedence on conflicts)
	merged.custom = {
		...(aloware.custom || {}),
		...(ghl.custom || {}),
	};
	if (Object.keys(merged.custom).length > 0) {
		decisions.push({ field: "custom", value: merged.custom, source: "merged", reason: "GHL precedence" });
	}

	// UpdatedAt: use most recent
	const ghlUpdated = ghl.updatedAt ? new Date(ghl.updatedAt).getTime() : 0;
	const alowareUpdated = aloware.updatedAt ? new Date(aloware.updatedAt).getTime() : 0;
	if (ghlUpdated > alowareUpdated) {
		merged.updatedAt = ghl.updatedAt;
	} else if (alowareUpdated > 0) {
		merged.updatedAt = aloware.updatedAt;
	}

	return { merged, decisions };
}

