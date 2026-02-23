/**
 * API Endpoint Registry
 * 
 * Loads and manages the Verity API catalog for endpoint validation and routing.
 */

import { readFile } from "fs/promises";
import { join } from "path";

export interface EndpointInfo {
	path: string;
	methods: string[];
	filePath: string;
	description?: string;
	parameters?: {
		path?: Record<string, string>;
		query?: Record<string, string>;
		body?: unknown;
	};
	authRequired?: boolean;
	authType?: "requireUser" | "requireAuth" | "requireAdmin" | "none";
	schema?: {
		request?: unknown;
		response?: unknown;
	};
}

export interface ApiCatalog {
	version: string;
	generatedAt: string;
	endpoints: EndpointInfo[];
	domains: Record<string, string[]>;
	statistics: {
		totalEndpoints: number;
		totalFiles: number;
		methods: Record<string, number>;
		domains: Record<string, number>;
	};
}

let cachedCatalog: ApiCatalog | null = null;

/**
 * Load API catalog from Verity repository
 * 
 * Note: In production, this should be loaded from a shared location
 * or fetched from Verity's API catalog endpoint.
 */
export async function loadApiCatalog(): Promise<ApiCatalog | null> {
	if (cachedCatalog) {
		return cachedCatalog;
	}

	try {
		// Path to Verity API catalog
		// In production, this should be configurable or fetched via HTTP
		const catalogPath = process.env.VERITY_CATALOG_PATH || 
			join(process.cwd(), "../verity/docs/df-middleware/api-catalog.json");
		
		const catalogContent = await readFile(catalogPath, "utf-8");
		cachedCatalog = JSON.parse(catalogContent) as ApiCatalog;
		
		console.log(`[registry] Loaded API catalog: ${cachedCatalog.statistics.totalEndpoints} endpoints`);
		return cachedCatalog;
	} catch (error) {
		console.error("[registry] Failed to load API catalog:", error);
		return null;
	}
}

/**
 * Find endpoint information by path and method
 */
export function getEndpoint(
	catalog: ApiCatalog,
	path: string,
	method: string
): EndpointInfo | null {
	// Normalize path (handle both [id] and {id} patterns, and /api vs /api/ prefix)
	const normalizedPath = path
		.replace(/^\/api\//, "/api")
		.replace(/^\/api$/, "/api")
		.replace(/\{([^}]+)\}/g, "[$1]");
	
	const endpoint = catalog.endpoints.find(
		(ep) => {
			const epPath = ep.path
				.replace(/^\/api\//, "/api")
				.replace(/^\/api$/, "/api")
				.replace(/\{([^}]+)\}/g, "[$1]");
			return epPath === normalizedPath && ep.methods.includes(method);
		}
	);
	
	return endpoint || null;
}

/**
 * Validate endpoint exists in catalog
 */
export function validateEndpoint(
	catalog: ApiCatalog,
	path: string,
	method: string
): boolean {
	return getEndpoint(catalog, path, method) !== null;
}
