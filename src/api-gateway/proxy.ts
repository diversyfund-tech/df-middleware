/**
 * HTTP Proxy to Verity API
 * 
 * Proxies requests from df-middleware to Verity API endpoints.
 */

import { logger } from "@/lib/logger";
import { externalApiCallsTotal, externalApiErrorsTotal, externalApiLatency } from "@/lib/metrics";

export interface ProxyRequest {
	endpoint: string;
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	params?: Record<string, string>;
	query?: Record<string, string>;
	body?: unknown;
	headers?: Record<string, string>;
	authToken?: string;
}

export interface ProxyResponse {
	success: boolean;
	data?: unknown;
	error?: {
		message: string;
		code?: string;
		details?: unknown;
	};
	meta: {
		endpoint: string;
		method: string;
		status: number;
		duration: number;
		timestamp: string;
	};
}

/**
 * Resolve dynamic route path
 * Converts "/api/comms/broadcasts/{id}" with params { id: "123" } to "/api/comms/broadcasts/123"
 * Also converts "/apicalls/..." to "/api/calls/..." to match Verity's actual route structure
 */
function resolveRoutePath(endpoint: string, params?: Record<string, string>): string {
	let resolved = endpoint;
	
	// Convert "/apicalls/..." to "/api/calls/..." to match Verity's actual route structure
	if (resolved.startsWith("/apicalls")) {
		resolved = resolved.replace("/apicalls", "/api/calls");
	}
	
	// Convert "/apisms" to "/api/integrations/df-middleware/send-message" (the actual SMS endpoint)
	// This is the correct endpoint for sending SMS messages via Verity
	if (resolved === "/apisms" || resolved.startsWith("/apisms/")) {
		resolved = "/api/integrations/df-middleware/send-message";
	}
	
	// Convert "/apicomms/..." to "/api/comms/..." to match Verity's actual route structure
	if (resolved.startsWith("/apicomms")) {
		resolved = resolved.replace("/apicomms", "/api/comms");
	}
	
	if (!params || Object.keys(params).length === 0) {
		return resolved;
	}

	for (const [key, value] of Object.entries(params)) {
		// Replace both [key] and {key} patterns
		resolved = resolved.replace(new RegExp(`\\[${key}\\]`, "g"), value);
		resolved = resolved.replace(new RegExp(`\\{${key}\\}`, "g"), value);
	}

	return resolved;
}

/**
 * Build query string from query parameters
 */
function buildQueryString(query?: Record<string, string>): string {
	if (!query || Object.keys(query).length === 0) {
		return "";
	}

	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		params.append(key, value);
	}

	return `?${params.toString()}`;
}

/**
 * Proxy request to Verity API
 */
export async function proxyToVerity(
	request: ProxyRequest,
	baseUrl: string
): Promise<ProxyResponse> {
	const startTime = Date.now();

	try {
		// Resolve route path with parameters
		const resolvedPath = resolveRoutePath(request.endpoint, request.params);
		const queryString = buildQueryString(request.query);
		const targetUrl = `${baseUrl}${resolvedPath}${queryString}`;

		logger.debug({
			method: request.method,
			endpoint: request.endpoint,
			targetUrl,
		}, "Proxying request to Verity");

		// Build headers
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...request.headers,
		};

		// Add authentication token if provided
		if (request.authToken) {
			headers["Authorization"] = `Bearer ${request.authToken}`;
		}

		// Make request
		const fetchOptions: RequestInit = {
			method: request.method,
			headers,
			redirect: "follow", // Follow redirects (307, 308)
		};

		if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
			fetchOptions.body = JSON.stringify(request.body);
		}

		const apiStartTime = Date.now();
		const response = await fetch(targetUrl, fetchOptions);
		const apiDuration = (Date.now() - apiStartTime) / 1000;
		const duration = Date.now() - startTime;

		// Record external API metrics
		externalApiCallsTotal.inc({
			api_name: "verity",
			endpoint: resolvedPath,
			status: response.status.toString(),
		});
		externalApiLatency.observe({ api_name: "verity", endpoint: resolvedPath }, apiDuration);

		if (!response.ok) {
			externalApiErrorsTotal.inc({ api_name: "verity", endpoint: resolvedPath });
		}

		// Parse response
		let data: unknown;
		const contentType = response.headers.get("content-type");
		if (contentType?.includes("application/json")) {
			data = await response.json();
		} else {
			data = await response.text();
		}

		if (!response.ok) {
			// Sanitize error messages in production
			const isProduction = process.env.NODE_ENV === "production";
			let errorMessage: string;
			let errorDetails: unknown = undefined;
			
			if (typeof data === "object" && data !== null && "error" in data) {
				const errorObj = (data as { error: unknown }).error;
				if (isProduction) {
					// In production, only expose safe error messages
					errorMessage = typeof errorObj === "string" 
						? errorObj.replace(/\/[^\s]+/g, "[path]") // Remove file paths
						: `HTTP ${response.status}: ${response.statusText}`;
				} else {
					errorMessage = String(errorObj);
					errorDetails = data;
				}
			} else {
				errorMessage = `HTTP ${response.status}: ${response.statusText}`;
				if (!isProduction) {
					errorDetails = data;
				}
			}
			
			return {
				success: false,
				error: {
					message: errorMessage,
					code: `HTTP_${response.status}`,
					...(errorDetails && { details: errorDetails }),
				},
				meta: {
					endpoint: request.endpoint,
					method: request.method,
					status: response.status,
					duration,
					timestamp: new Date().toISOString(),
				},
			};
		}

		return {
			success: true,
			data,
			meta: {
				endpoint: request.endpoint,
				method: request.method,
				status: response.status,
				duration,
				timestamp: new Date().toISOString(),
			},
		};
	} catch (error) {
		const duration = Date.now() - startTime;
		const isProduction = process.env.NODE_ENV === "production";
		
		// Sanitize error messages in production
		let errorMessage: string;
		if (error instanceof Error) {
			if (isProduction) {
				// In production, hide stack traces and internal paths
				errorMessage = error.message
					.replace(/\/[^\s]+/g, "[path]") // Remove file paths
					.replace(/at\s+[^\n]+/g, "") // Remove stack trace lines
					.trim() || "Internal server error";
			} else {
				errorMessage = error.message;
			}
		} else {
			errorMessage = "Unknown error";
		}

		// Record error metric
		externalApiErrorsTotal.inc({ api_name: "verity", endpoint: request.endpoint });

		logger.error({
			method: request.method,
			endpoint: request.endpoint,
			error: isProduction ? errorMessage : error,
			duration,
		}, "Error proxying request to Verity");

		return {
			success: false,
			error: {
				message: errorMessage,
				code: "PROXY_ERROR",
			},
			meta: {
				endpoint: request.endpoint,
				method: request.method,
				status: 500,
				duration,
				timestamp: new Date().toISOString(),
			},
		};
	}
}
