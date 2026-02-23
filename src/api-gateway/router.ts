/**
 * API Gateway Router
 * 
 * Routes requests from df-middleware to Verity API via proxy.
 */

import express, { Request, Response } from "express";
import { proxyToVerity, ProxyRequest } from "./proxy.js";
import { loadApiCatalog, validateEndpoint } from "./registry.js";
import { verifyAuthToken, extractAuthToken } from "../auth/verity-auth.js";

export const router = express.Router();

const VERITY_BASE_URL = process.env.VERITY_BASE_URL || "http://localhost:3000";

/**
 * Validate API key for middleware-to-middleware communication
 */
function validateApiKey(req: Request): boolean {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return false;
	}

	const token = authHeader.replace(/^Bearer\s+/i, "");
	const expectedKey = process.env.DF_MIDDLEWARE_API_KEY;

	if (!expectedKey) {
		console.warn("[router] DF_MIDDLEWARE_API_KEY not configured");
		return false;
	}

	return token === expectedKey;
}

/**
 * POST /api/verity
 * Proxy request to Verity API
 */
router.post("/", async (req: Request, res: Response) => {
	console.log("[router] Received gateway request");

	// Validate API key
	if (!validateApiKey(req)) {
		console.error("[router] Invalid API key");
		return res.status(401).json({
			success: false,
			error: { message: "Unauthorized", code: "UNAUTHORIZED" },
		});
	}

	// Parse request body
	const gatewayReq: ProxyRequest = req.body;

	// Validate required fields
	if (!gatewayReq.endpoint || !gatewayReq.method) {
		return res.status(400).json({
			success: false,
			error: {
				message: "Missing required fields: endpoint and method are required",
				code: "INVALID_REQUEST",
			},
		});
	}

	// Validate endpoint format (accepts /api/ or /api)
	if (!gatewayReq.endpoint.startsWith("/api")) {
		return res.status(400).json({
			success: false,
			error: {
				message: "Endpoint must start with /api",
				code: "INVALID_ENDPOINT",
			},
		});
	}

	// Validate HTTP method
	const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
	if (!validMethods.includes(gatewayReq.method)) {
		return res.status(400).json({
			success: false,
			error: {
				message: `Invalid method. Must be one of: ${validMethods.join(", ")}`,
				code: "INVALID_METHOD",
			},
		});
	}

	// Optional: Validate endpoint exists in catalog
	const catalog = await loadApiCatalog();
	if (catalog) {
		const endpointExists = validateEndpoint(
			catalog,
			gatewayReq.endpoint,
			gatewayReq.method
		);

		if (!endpointExists) {
			console.warn(
				`[router] Endpoint ${gatewayReq.method} ${gatewayReq.endpoint} not found in catalog`
			);
			// Don't fail, just warn - endpoint might be new or catalog might be outdated
		}
	}

	// Extract and verify auth token if provided
	let authToken: string | undefined;
	if (gatewayReq.headers?.Authorization) {
		const token = extractAuthToken(gatewayReq.headers.Authorization);
		if (token) {
			// Verify token (this will throw if invalid)
			try {
				await verifyAuthToken(token);
				authToken = token;
			} catch (error) {
				return res.status(401).json({
					success: false,
					error: {
						message: "Invalid authentication token",
						code: "INVALID_TOKEN",
					},
				});
			}
		}
	}

	// Proxy the request
	const response = await proxyToVerity(
		{
			...gatewayReq,
			authToken,
		},
		VERITY_BASE_URL
	);

	// Return appropriate HTTP status
	const status = response.success ? response.meta.status : response.meta.status || 500;
	return res.status(status).json(response);
});

/**
 * GET /api/verity
 * Retrieve API catalog and available endpoints
 */
router.get("/", async (req: Request, res: Response) => {
	console.log("[router] Received catalog request");

	// Validate API key
	if (!validateApiKey(req)) {
		return res.status(401).json({
			success: false,
			error: { message: "Unauthorized", code: "UNAUTHORIZED" },
		});
	}

	// Load and return API catalog
	const catalog = await loadApiCatalog();
	if (!catalog) {
		return res.status(503).json({
			success: false,
			error: { message: "API catalog not available", code: "CATALOG_UNAVAILABLE" },
		});
	}

	return res.json({
		success: true,
		data: {
			catalog,
			gateway: {
				endpoint: "/api/verity",
				method: "POST",
				description: "Proxy requests to any Verity API endpoint",
			},
		},
	});
});
