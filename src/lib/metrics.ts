/**
 * Prometheus metrics collection
 * 
 * Exposes metrics for monitoring:
 * - HTTP request rate, errors, latency
 * - Job queue depth and processing time
 * - Webhook processing rate
 * - Sync operation success rate
 * - External API call latency
 */

import { Registry, Counter, Histogram, Gauge } from "prom-client";

// Create a registry to register metrics
export const register = new Registry();

// HTTP metrics
export const httpRequestsTotal = new Counter({
	name: "http_requests_total",
	help: "Total number of HTTP requests",
	labelNames: ["method", "route", "status"],
	registers: [register],
});

export const httpRequestDuration = new Histogram({
	name: "http_request_duration_seconds",
	help: "Duration of HTTP requests in seconds",
	labelNames: ["method", "route", "status"],
	buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
	registers: [register],
});

export const httpErrorsTotal = new Counter({
	name: "http_errors_total",
	help: "Total number of HTTP errors",
	labelNames: ["method", "route", "status"],
	registers: [register],
});

// Webhook metrics
export const webhookEventsTotal = new Counter({
	name: "webhook_events_total",
	help: "Total number of webhook events received",
	labelNames: ["source", "event_type"],
	registers: [register],
});

export const webhookEventsProcessedTotal = new Counter({
	name: "webhook_events_processed_total",
	help: "Total number of webhook events processed",
	labelNames: ["source", "status"],
	registers: [register],
});

export const webhookProcessingDuration = new Histogram({
	name: "webhook_processing_duration_seconds",
	help: "Duration of webhook processing in seconds",
	labelNames: ["source", "event_type"],
	buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
	registers: [register],
});

// Sync operation metrics
export const syncOperationsTotal = new Counter({
	name: "sync_operations_total",
	help: "Total number of sync operations",
	labelNames: ["direction", "entity_type", "status"],
	registers: [register],
});

export const syncOperationDuration = new Histogram({
	name: "sync_operation_duration_seconds",
	help: "Duration of sync operations in seconds",
	labelNames: ["direction", "entity_type"],
	buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
	registers: [register],
});

// Job queue metrics
export const jobQueueDepth = new Gauge({
	name: "job_queue_depth",
	help: "Current depth of job queue",
	labelNames: ["queue_name"],
	registers: [register],
});

export const jobProcessingDuration = new Histogram({
	name: "job_processing_duration_seconds",
	help: "Duration of job processing in seconds",
	labelNames: ["queue_name"],
	buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
	registers: [register],
});

export const jobFailuresTotal = new Counter({
	name: "job_failures_total",
	help: "Total number of job failures",
	labelNames: ["queue_name"],
	registers: [register],
});

// External API metrics
export const externalApiCallsTotal = new Counter({
	name: "external_api_calls_total",
	help: "Total number of external API calls",
	labelNames: ["api_name", "endpoint", "status"],
	registers: [register],
});

export const externalApiErrorsTotal = new Counter({
	name: "external_api_errors_total",
	help: "Total number of external API errors",
	labelNames: ["api_name", "endpoint"],
	registers: [register],
});

export const externalApiLatency = new Histogram({
	name: "external_api_latency_seconds",
	help: "Latency of external API calls in seconds",
	labelNames: ["api_name", "endpoint"],
	buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
	registers: [register],
});

// Database metrics
export const databaseConnectionsActive = new Gauge({
	name: "database_connections_active",
	help: "Number of active database connections",
	registers: [register],
});

export const databaseQueryDuration = new Histogram({
	name: "database_query_duration_seconds",
	help: "Duration of database queries in seconds",
	labelNames: ["operation"],
	buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
	registers: [register],
});

// Register default metrics (CPU, memory, etc.)
register.setDefaultLabels({
	service: "df-middleware",
});
