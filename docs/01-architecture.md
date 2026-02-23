# Architecture

## Executive Summary

DF-Middleware uses a hybrid architecture combining Express.js for the API gateway, Next.js for webhook endpoints, and a standalone MCP server. The system processes webhooks asynchronously via pg-boss job queue, maintains bidirectional sync between GHL and Aloware, and provides a unified API gateway to Verity.

**Key Design Decisions:**
- Express for API gateway (simpler than Next.js for proxy use case)
- Next.js for webhook handlers (better Vercel integration)
- pg-boss for job processing (PostgreSQL-native, reliable)
- Clerk JWT for Verity API authentication
- Deduplication via `dedupeKey` to prevent duplicate processing

## Engineering Details

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DF-Middleware System                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                │
│  │   Express    │         │   Next.js    │                │
│  │   Server     │         │   API Routes │                │
│  │  (Port 3001) │         │  (Port 3002) │                │
│  └──────┬───────┘         └──────┬───────┘                │
│         │                        │                         │
│         │  ┌─────────────────────┘                         │
│         │  │                                                 │
│         ▼  ▼                                                 │
│  ┌─────────────────────────────────────┐                   │
│  │      API Gateway Router              │                   │
│  │  (src/api-gateway/router.ts)         │                   │
│  └──────────────┬──────────────────────┘                   │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────┐                   │
│  │      Proxy to Verity API              │                   │
│  │  (src/api-gateway/proxy.ts)           │                   │
│  └───────────────────────────────────────┘                   │
│                                                             │
│  ┌─────────────────────────────────────┐                   │
│  │      MCP Server (stdio)              │                   │
│  │  (src/mcp/server.ts)                 │                   │
│  └──────────────┬──────────────────────┘                   │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────┐                   │
│  │   Tool Generator & API Catalog      │                   │
│  │  (src/mcp/tools/generator.ts)        │                   │
│  └──────────────────────────────────────┘                   │
│                                                             │
│  ┌─────────────────────────────────────┐                   │
│  │      Webhook Handlers                │                   │
│  │  (src/app/api/webhooks/)             │                   │
│  └──────────────┬──────────────────────┘                   │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────┐                   │
│  │      pg-boss Job Queue               │                   │
│  │  (src/lib/jobs/boss.ts)              │                   │
│  └──────────────┬──────────────────────┘                   │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────┐                   │
│  │      Sync Library                    │                   │
│  │  (src/lib/sync/)                     │                   │
│  └──────────────────────────────────────┘                   │
│                                                             │
│  ┌─────────────────────────────────────┐                   │
│  │      PostgreSQL Database             │                   │
│  │  (Drizzle ORM)                       │                   │
│  └──────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Runtime Model

#### Express Server (`src/index.ts`)

**Entry Point**: `bun run dev` → `src/index.ts`

**Responsibilities**:
- HTTP server on port 3001 (configurable via `PORT`)
- CORS middleware
- JSON body parsing
- Health check endpoint (`GET /health`)
- API Gateway routing (`/api/verity`)

**Lifecycle**:
1. Server starts and binds to port
2. Registers API gateway router
3. Logs startup information
4. Handles incoming requests

**File**: `src/index.ts:1-38`

#### Next.js API Routes (`src/app/api/`)

**Entry Point**: `bun run dev:next` → Next.js dev server on port 3002

**Structure**:
- `webhooks/` - Webhook handlers (GHL, Aloware, texting, broadcast)
- `admin/` - Admin endpoints (events, agents, lists, mappings)
- `jobs/` - Job processing endpoints
- `sync/` - Manual sync triggers
- `test/` - Test/debug endpoints
- `mcp/` - MCP chat interface

**Deployment**: Vercel serverless functions

**File**: `src/app/api/**/*.ts`

#### MCP Server (`src/mcp/server.ts`)

**Entry Point**: `bun run mcp` → `src/mcp/server.ts`

**Protocol**: Model Context Protocol over stdio

**Responsibilities**:
- Loads Verity API catalog on startup
- Generates MCP tools from catalog endpoints
- Handles `list_tools` requests
- Handles `call_tool` requests with Clerk authentication
- Proxies tool calls to Verity API

**Authentication Flow**:
1. Gets Clerk session token via `getClerkSessionToken()`
2. Caches token for 55 minutes
3. Auto-refreshes on 401 errors
4. Passes token as `Authorization: Bearer <token>` header

**File**: `src/mcp/server.ts:1-295`

#### Job Queue (`src/lib/jobs/boss.ts`)

**Technology**: pg-boss (PostgreSQL-based job queue)

**Queues**:
- `process-webhook-event` - Webhook event processing
- `process-broadcast-event` - Broadcast event processing

**Configuration**:
- Retry limit: 10
- Retry delay: 60 seconds
- Retry backoff: enabled

**Cron Jobs** (Vercel):
- `/api/jobs/process-pending` - Every 5 minutes

**File**: `src/lib/jobs/boss.ts:1-57`

### Request Flow

#### API Gateway Request Flow

```
Client Request
    │
    ▼
Express Server (port 3001)
    │
    ▼
API Gateway Router (src/api-gateway/router.ts)
    │
    ├─► Validate API Key (DF_MIDDLEWARE_API_KEY)
    │
    ├─► Validate Request Body (endpoint, method)
    │
    ├─► Load API Catalog (optional validation)
    │
    ├─► Extract Auth Token (if provided)
    │
    ├─► Verify Auth Token (Clerk JWT)
    │
    ▼
Proxy to Verity (src/api-gateway/proxy.ts)
    │
    ├─► Resolve Route Path (handle path params)
    │
    ├─► Build Query String
    │
    ├─► Add Authorization Header
    │
    ▼
Verity API (VERITY_BASE_URL)
    │
    ▼
Response
    │
    ▼
Client
```

#### Webhook Processing Flow

```
External Webhook (GHL/Aloware/Texting)
    │
    ▼
Next.js API Route (src/app/api/webhooks/*)
    │
    ├─► Validate Webhook Signature (if configured)
    │
    ├─► Create Dedupe Key (source + eventType + entityId)
    │
    ├─► Check for Duplicate (dedupeKey in database)
    │
    ├─► Insert Webhook Event (status: 'pending')
    │
    ▼
Enqueue Job (pg-boss)
    │
    ▼
Job Worker (src/scripts/worker.ts)
    │
    ├─► Process Webhook Event
    │
    ├─► Determine Sync Direction
    │
    ├─► Call Sync Library Function
    │
    ├─► Update Event Status ('done' or 'error')
    │
    ├─► Log Sync Operation (sync_log table)
    │
    ▼
Complete
```

#### MCP Tool Call Flow

```
MCP Client (AI Agent)
    │
    ▼
MCP Server (stdio)
    │
    ├─► Parse Tool Call Request
    │
    ├─► Find Tool Definition (from catalog)
    │
    ├─► Resolve Endpoint Path
    │
    ├─► Extract Parameters (path, query, body)
    │
    ├─► Get Clerk Session Token (cached or fresh)
    │
    ▼
Proxy to Verity (src/api-gateway/proxy.ts)
    │
    ├─► Build Request URL
    │
    ├─► Add Authorization Header (Clerk JWT)
    │
    ▼
Verity API
    │
    ▼
Response
    │
    ├─► Handle 401 (refresh token, retry)
    │
    ▼
MCP Client
```

### Data Flow

#### Contact Sync Flow

```
GHL Contact Updated
    │
    ▼
GHL Webhook → webhook_events (status: 'pending')
    │
    ▼
Job Worker Processes Event
    │
    ├─► Check Contact Mapping (contact_mappings table)
    │
    ├─► If exists: Update Aloware Contact
    │
    ├─► If not exists: Create in Aloware, Create Mapping
    │
    ├─► Update sync_log
    │
    ▼
Aloware Contact Updated
    │
    ▼
Aloware Webhook → webhook_events (status: 'pending')
    │
    ▼
Job Worker Processes Event
    │
    ├─► Check Contact Mapping
    │
    ├─► Update GHL Contact
    │
    ├─► Update sync_log
    │
    ▼
Complete
```

#### Message Sync Flow

```
Texting System Message
    │
    ▼
Texting Webhook → texting_webhook_events (status: 'pending')
    │
    ▼
Job Worker Processes Event
    │
    ├─► Check Message Mapping (message_mappings table)
    │
    ├─► Create/Update GHL Message (via conversations API)
    │
    ├─► Create/Update Aloware Message (if contact exists)
    │
    ├─► Create Message Mapping
    │
    ├─► Update sync_log
    │
    ▼
Complete
```

### Component Interactions

#### API Gateway ↔ Proxy

**Interface**: `ProxyRequest` → `ProxyResponse`

**Key Functions**:
- `proxyToVerity(request, baseUrl)` - Main proxy function
- `resolveRoutePath(endpoint, params)` - Resolves dynamic routes
- `buildQueryString(query)` - Builds query parameters

**File**: `src/api-gateway/proxy.ts:90-190`

#### MCP Server ↔ API Gateway

**Interface**: Tool call → Proxy request

**Key Functions**:
- `findEndpointFromToolName(toolName)` - Maps tool name to endpoint
- `generateTools(catalog)` - Creates MCP tools from catalog

**File**: `src/mcp/server.ts:59-129`, `src/mcp/tools/generator.ts`

#### Webhook Handlers ↔ Job Queue

**Interface**: Webhook event → pg-boss job

**Key Functions**:
- `getBoss()` - Gets pg-boss instance
- `boss.send(queue, payload)` - Enqueues job

**File**: `src/lib/jobs/boss.ts:42-47`

#### Sync Library ↔ External APIs

**Interface**: Sync function → GHL/Aloware API calls

**Key Modules**:
- `src/lib/sync/contact-sync.ts` - Contact synchronization
- `src/lib/sync/call-sync.ts` - Call synchronization
- `src/lib/sync/message-sync.ts` - Message synchronization
- `src/lib/ghl/client.ts` - GHL API client
- `src/lib/aloware/client.ts` - Aloware API client

### Error Handling

#### API Gateway Errors

- **401 Unauthorized**: Invalid API key or auth token
- **400 Bad Request**: Missing required fields or invalid format
- **503 Service Unavailable**: API catalog not available
- **500 Internal Server Error**: Proxy error or Verity API error

**File**: `src/api-gateway/router.ts:40-139`

#### MCP Server Errors

- **Tool Not Found**: Unknown tool name
- **Endpoint Resolution Failed**: Cannot map tool to endpoint
- **Authentication Failed**: Clerk token refresh failed
- **Proxy Error**: Verity API request failed

**File**: `src/mcp/server.ts:145-280`

#### Webhook Processing Errors

- **Duplicate Event**: Event already processed (dedupeKey exists)
- **Sync Error**: External API call failed
- **Mapping Error**: Cannot find contact/message mapping

**Error Handling**: Events marked as `status: 'error'` with `errorMessage` field

### Scalability Considerations

1. **Job Queue**: pg-boss handles concurrent job processing
2. **Database Indexes**: Optimized for webhook deduplication and sync lookups
3. **Token Caching**: Clerk tokens cached to reduce API calls
4. **Vercel Serverless**: Auto-scales webhook handlers
5. **Express Server**: Single instance (consider load balancer for production)

### Deployment Architecture

#### Vercel Deployment

- **Next.js API Routes**: Serverless functions
- **Cron Jobs**: Vercel cron configuration (`vercel.json`)
- **Environment Variables**: Vercel dashboard

**File**: `vercel.json:1-8`

#### Express Server Deployment

- **Standalone Process**: Runs `src/index.ts`
- **Port**: 3001 (configurable)
- **Health Check**: `GET /health` for monitoring

### Known Architecture Limitations

1. **Single Express Instance**: No built-in load balancing
2. **Token Cache**: In-memory (lost on restart)
3. **Clerk Auth**: Placeholder implementation (see `src/auth/verity-auth.ts:35-56`)
4. **Sync Race Conditions**: Possible during high-volume periods
5. **MCP Server**: Requires active Clerk session (see `src/auth/clerk-token-manager.ts:68-82`)
