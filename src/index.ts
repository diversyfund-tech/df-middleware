#!/usr/bin/env bun
/**
 * DF-Middleware Express Server
 * 
 * Main entry point for the df-middleware service.
 * Provides API gateway and MCP server functionality.
 */

import express from "express";
import cors from "cors";
import { router } from "./api-gateway/router.js";
import { apiRateLimiter } from "./lib/middleware/rate-limit.js";
import { logger } from "./lib/logger.js";
import { httpRequestsTotal, httpRequestDuration, httpErrorsTotal } from "./lib/metrics.js";

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions: cors.CorsOptions = {
	origin: (origin, callback) => {
		const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
		
		// In development, allow all origins
		if (process.env.NODE_ENV === "development") {
			callback(null, true);
			return;
		}
		
		// In production, check against allowed origins
		if (!allowedOrigins) {
			// If no allowed origins configured in production, deny all
			callback(new Error("CORS not configured - no allowed origins specified"));
			return;
		}
		
		const origins = allowedOrigins.split(",").map(o => o.trim());
		
		// Allow requests with no origin (like mobile apps or curl requests)
		if (!origin) {
			callback(null, true);
			return;
		}
		
		if (origins.includes(origin)) {
			callback(null, true);
		} else {
			callback(new Error(`Origin ${origin} not allowed by CORS`));
		}
	},
	credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Request logging and metrics middleware
app.use((req, res, next) => {
	const startTime = Date.now();
	const route = req.route?.path || req.path;

	// Log request
	logger.info({
		method: req.method,
		path: req.path,
		ip: req.ip,
	}, "Incoming request");

	// Track response
	res.on("finish", () => {
		const duration = (Date.now() - startTime) / 1000;
		const status = res.statusCode;

		// Record metrics
		httpRequestsTotal.inc({ method: req.method, route, status: status.toString() });
		httpRequestDuration.observe({ method: req.method, route, status: status.toString() }, duration);

		if (status >= 400) {
			httpErrorsTotal.inc({ method: req.method, route, status: status.toString() });
		}

		// Log response
		logger.info({
			method: req.method,
			path: req.path,
			status,
			duration,
		}, "Request completed");
	});

	next();
});

// Apply rate limiting to all routes (except health check which is skipped in the limiter)
app.use(apiRateLimiter);

// Health check endpoint with dependency verification
app.get("/health", async (req, res) => {
	const checks: Record<string, { status: string; message?: string }> = {};
	let allHealthy = true;

	// Check database connectivity
	try {
		const { db } = await import("./server/db/index.js");
		await db.execute({ sql: "SELECT 1", args: [] });
		checks.database = { status: "ok" };
	} catch (error) {
		checks.database = {
			status: "error",
			message: error instanceof Error ? error.message : "Unknown error",
		};
		allHealthy = false;
	}

	// Check pg-boss queue
	try {
		const { getBoss } = await import("./lib/jobs/boss.js");
		const boss = getBoss();
		// Check if boss is running (basic check)
		if (boss) {
			checks.jobQueue = { status: "ok" };
		} else {
			checks.jobQueue = { status: "error", message: "PgBoss not initialized" };
			allHealthy = false;
		}
	} catch (error) {
		checks.jobQueue = {
			status: "error",
			message: error instanceof Error ? error.message : "Unknown error",
		};
		allHealthy = false;
	}

	// Check external APIs (non-blocking, just verify connectivity)
	const externalApis = ["GHL", "Aloware", "Verity"];
	for (const api of externalApis) {
		try {
			// Simple connectivity check - just verify env vars are set
			if (api === "GHL" && process.env.GHL_API_KEY) {
				checks[`externalApi_${api.toLowerCase()}`] = { status: "ok" };
			} else if (api === "Aloware" && process.env.ALOWARE_API_TOKEN) {
				checks[`externalApi_${api.toLowerCase()}`] = { status: "ok" };
			} else if (api === "Verity" && process.env.VERITY_BASE_URL) {
				checks[`externalApi_${api.toLowerCase()}`] = { status: "ok" };
			} else {
				checks[`externalApi_${api.toLowerCase()}`] = {
					status: "warning",
					message: "Configuration not found",
				};
			}
		} catch (error) {
			checks[`externalApi_${api.toLowerCase()}`] = {
				status: "warning",
				message: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	const statusCode = allHealthy ? 200 : 503;
	res.status(statusCode).json({
		status: allHealthy ? "ok" : "degraded",
		timestamp: new Date().toISOString(),
		service: "df-middleware",
		checks,
	});
});

// API Gateway routes
app.use("/api/verity", router);

// Start Express server
app.listen(PORT, () => {
	logger.info({
		port: PORT,
		service: "df-middleware",
	}, "Server started");
	logger.info({
		apiGateway: `http://localhost:${PORT}/api/verity`,
		healthCheck: `http://localhost:${PORT}/health`,
		metrics: `http://localhost:${PORT}/api/metrics`,
	}, "Service endpoints");
});

// Note: MCP server runs separately via stdio: bun src/mcp/server.ts
