# Observability and Operations

## Executive Summary

DF-Middleware uses console logging for observability, pg-boss job queue for async processing, and database tables for audit trails. Health check endpoint provides basic monitoring. No structured logging, metrics, or alerting currently implemented.

**Observability Gaps:**
- No structured logging (console.log only)
- No metrics collection
- No alerting system
- No distributed tracing
- Limited error tracking

**Operational Features:**
- Health check endpoint (`GET /health`)
- Job queue monitoring via database queries
- Audit logging via `sync_log` table
- Webhook event status tracking

## Engineering Details

### Logging

#### Current Implementation

**Method**: Console logging (`console.log`, `console.error`, `console.warn`)

**Examples**:
- `src/index.ts:34-36` - Server startup logs
- `src/lib/ghl/client.ts:50,82-98` - API request logs
- `src/mcp/server.ts:43,51,60,102` - MCP server logs

**Log Levels**: 
- `console.log` - Info
- `console.error` - Errors
- `console.warn` - Warnings

**Issues**:
- No structured format
- May log sensitive data
- No log aggregation
- Lost on process restart

#### Recommended Logging Structure

**Format**: JSON structured logs

**Fields**:
- `timestamp` - ISO 8601 timestamp
- `level` - 'info' | 'warn' | 'error'
- `service` - 'df-middleware'
- `component` - Component name (e.g., 'api-gateway', 'mcp-server')
- `message` - Log message
- `metadata` - Additional context (request ID, user ID, etc.)

**Example**:
```json
{
  "timestamp": "2024-01-19T12:00:00Z",
  "level": "info",
  "service": "df-middleware",
  "component": "api-gateway",
  "message": "Proxying request to Verity",
  "metadata": {
    "endpoint": "/api/comms/broadcasts",
    "method": "GET",
    "requestId": "req_123"
  }
}
```

### Metrics

#### Current State

**Status**: No metrics collection implemented

**Missing Metrics**:
- Request rate (requests per second)
- Error rate (errors per second)
- Latency (p50, p95, p99)
- Job queue depth
- Webhook processing rate
- Sync operation success rate
- External API call latency

#### Recommended Metrics

**Application Metrics**:
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `http_errors_total` - Total HTTP errors
- `webhook_events_total` - Total webhook events received
- `webhook_events_processed_total` - Total webhook events processed
- `sync_operations_total` - Total sync operations
- `sync_operations_duration_seconds` - Sync operation duration

**Job Queue Metrics**:
- `job_queue_depth` - Current queue depth
- `job_processing_duration_seconds` - Job processing duration
- `job_failures_total` - Total job failures

**External API Metrics**:
- `ghl_api_calls_total` - Total GHL API calls
- `ghl_api_errors_total` - Total GHL API errors
- `aloware_api_calls_total` - Total Aloware API calls
- `aloware_api_errors_total` - Total Aloware API errors
- `verity_api_calls_total` - Total Verity API calls
- `verity_api_errors_total` - Total Verity API errors

**Database Metrics**:
- `database_connections_active` - Active database connections
- `database_query_duration_seconds` - Query duration

### Health Checks

#### Health Check Endpoint

**Endpoint**: `GET /health`

**Location**: `src/index.ts:21-27`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-19T12:00:00.000Z",
  "service": "df-middleware"
}
```

**Status**: Always returns "ok" (no dependency checks)

**File**: `src/index.ts:21-27`

#### Recommended Health Checks

**Dependencies**:
- Database connectivity
- pg-boss queue health
- External API connectivity (GHL, Aloware, Verity)

**Example**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-19T12:00:00.000Z",
  "service": "df-middleware",
  "dependencies": {
    "database": "ok",
    "job_queue": "ok",
    "ghl_api": "ok",
    "aloware_api": "ok",
    "verity_api": "ok"
  }
}
```

### Monitoring

#### Job Queue Monitoring

**Method**: Database queries

**Tables**:
- `webhook_events` - Check `status = 'pending'` count
- `texting_webhook_events` - Check `status = 'pending'` count
- `broadcast_webhook_events` - Check `status = 'pending'` count

**Queries**:
```sql
-- Pending webhook events
SELECT COUNT(*) FROM webhook_events WHERE status = 'pending';

-- Failed webhook events
SELECT COUNT(*) FROM webhook_events WHERE status = 'error';

-- Processing time
SELECT AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) 
FROM webhook_events 
WHERE processed_at IS NOT NULL;
```

#### Sync Operation Monitoring

**Table**: `sync_log`

**Queries**:
```sql
-- Sync success rate
SELECT 
  direction,
  entity_type,
  COUNT(*) FILTER (WHERE status = 'success') * 100.0 / COUNT(*) as success_rate
FROM sync_log
GROUP BY direction, entity_type;

-- Recent sync errors
SELECT * FROM sync_log 
WHERE status = 'error' 
ORDER BY started_at DESC 
LIMIT 10;
```

#### Webhook Event Monitoring

**Queries**:
```sql
-- Events by source and status
SELECT source, status, COUNT(*) 
FROM webhook_events 
GROUP BY source, status;

-- Recent errors
SELECT * FROM webhook_events 
WHERE status = 'error' 
ORDER BY received_at DESC 
LIMIT 10;
```

### Alerting

#### Current State

**Status**: No alerting system implemented

**Missing Alerts**:
- High error rate
- Job queue backup
- External API failures
- Database connection failures
- High latency

#### Recommended Alerts

**Critical Alerts**:
- Job queue depth > 1000
- Error rate > 5% for 5 minutes
- Database connection failures
- External API failures > 10% for 5 minutes

**Warning Alerts**:
- Job queue depth > 500
- Error rate > 1% for 5 minutes
- High latency (p95 > 5 seconds)
- Webhook processing delay > 10 minutes

**Alert Destination**: `ALERT_WEBHOOK_URL` (optional, configured but not used)

**File**: `env.mjs:47-59`

### Error Tracking

#### Current State

**Method**: Console error logging

**Storage**: 
- `webhook_events.error_message` - Webhook processing errors
- `sync_log.error_message` - Sync operation errors

**Issues**:
- No error aggregation
- No error grouping
- No error notification

#### Recommended Error Tracking

**Tool**: Sentry or similar

**Features**:
- Error aggregation
- Error grouping
- Stack traces
- Context (user, request, environment)
- Alerting

### Distributed Tracing

#### Current State

**Status**: No distributed tracing

**Missing**:
- Request ID propagation
- Trace context
- Span tracking

#### Recommended Tracing

**Tool**: OpenTelemetry

**Spans**:
- HTTP request handling
- External API calls
- Database queries
- Job processing

### Runbooks

#### Health Check

**Endpoint**: `GET /health`

**Expected**: `{"status": "ok", ...}`

**Action if down**: Check server logs, restart service

#### Job Queue Backup

**Symptoms**: High `status = 'pending'` count in `webhook_events`

**Diagnosis**:
```sql
SELECT COUNT(*) FROM webhook_events WHERE status = 'pending';
```

**Actions**:
1. Check job worker is running (`src/scripts/worker.ts`)
2. Check pg-boss is running (`src/lib/jobs/boss.ts`)
3. Check for errors in `webhook_events.error_message`
4. Manually trigger processing: `POST /api/jobs/process-pending`

#### Sync Failures

**Symptoms**: High error rate in `sync_log`

**Diagnosis**:
```sql
SELECT direction, entity_type, COUNT(*) 
FROM sync_log 
WHERE status = 'error' 
GROUP BY direction, entity_type;
```

**Actions**:
1. Check external API connectivity (GHL, Aloware)
2. Check API credentials
3. Review error messages in `sync_log.error_message`
4. Check for rate limiting

#### MCP Server Issues

**Symptoms**: MCP tool calls failing

**Diagnosis**:
- Check MCP server logs (`console.error` output)
- Check Clerk token: `getClerkSessionToken()`
- Check Verity API connectivity

**Actions**:
1. Verify `CLERK_SECRET_KEY` is set
2. Verify at least one Clerk user has active session
3. Check `VERITY_BASE_URL` is correct
4. Restart MCP server: `bun run mcp`

#### API Gateway Issues

**Symptoms**: `/api/verity` endpoint failing

**Diagnosis**:
- Check Express server logs
- Check API key validation
- Check Verity API connectivity

**Actions**:
1. Verify `DF_MIDDLEWARE_API_KEY` is set
2. Verify `VERITY_BASE_URL` is correct
3. Check Verity API health
4. Restart Express server: `bun run dev`

### Operational Procedures

#### Starting Services

**Express Server**:
```bash
bun run dev
```

**Next.js API Routes**:
```bash
bun run dev:next
```

**MCP Server**:
```bash
bun run mcp
```

**Job Worker**:
```bash
bun run src/scripts/worker.ts
```

#### Monitoring Job Queue

**Check Queue Depth**:
```sql
SELECT COUNT(*) FROM webhook_events WHERE status = 'pending';
```

**Process Pending Jobs**:
```bash
curl -X POST http://localhost:3002/api/jobs/process-pending \
  -H "Authorization: Bearer $DF_ADMIN_SECRET"
```

#### Debugging Webhook Events

**View Pending Events**:
```sql
SELECT * FROM webhook_events 
WHERE status = 'pending' 
ORDER BY received_at DESC 
LIMIT 10;
```

**Replay Event**:
```bash
curl -X POST http://localhost:3002/api/admin/events/{event_id}/replay \
  -H "Authorization: Bearer $DF_ADMIN_SECRET"
```

**Quarantine Event**:
```bash
curl -X POST http://localhost:3002/api/admin/events/{event_id}/quarantine \
  -H "Authorization: Bearer $DF_ADMIN_SECRET" \
  -d '{"reason": "Duplicate event"}'
```

### Performance Monitoring

#### Database Performance

**Slow Queries**:
```sql
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

**Table Sizes**:
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Job Processing Performance

**Average Processing Time**:
```sql
SELECT 
  AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) as avg_seconds
FROM webhook_events
WHERE processed_at IS NOT NULL;
```

**Processing Rate**:
```sql
SELECT 
  DATE_TRUNC('hour', processed_at) as hour,
  COUNT(*) as processed_count
FROM webhook_events
WHERE processed_at IS NOT NULL
GROUP BY hour
ORDER BY hour DESC;
```

### Known Observability Gaps

1. **No Structured Logging**: Console logging only
2. **No Metrics**: No metrics collection
3. **No Alerting**: No alerting system
4. **No Distributed Tracing**: No request tracing
5. **Limited Health Checks**: No dependency checks
6. **No Error Aggregation**: Errors not aggregated
7. **No Performance Monitoring**: No performance metrics

### Recommendations

1. **Implement Structured Logging**: Use logging library (Winston, Pino)
2. **Add Metrics**: Use Prometheus or similar
3. **Implement Alerting**: Use PagerDuty, Opsgenie, or similar
4. **Add Distributed Tracing**: Use OpenTelemetry
5. **Enhance Health Checks**: Add dependency checks
6. **Error Tracking**: Use Sentry or similar
7. **Performance Monitoring**: Add APM tool (Datadog, New Relic)
