# Services and Modules

## Executive Summary

DF-Middleware is organized into clear service boundaries: API Gateway, MCP Server, Webhook Processing, Sync Library, and Job Queue. Each module has a single responsibility and well-defined interfaces.

**Module Organization:**
- `api-gateway/` - Express router and proxy logic
- `mcp/` - MCP server and tool generation
- `lib/sync/` - Bidirectional sync between GHL and Aloware
- `lib/ghl/` - GoHighLevel API client
- `lib/aloware/` - Aloware API client
- `lib/jobs/` - pg-boss job queue management
- `app/api/` - Next.js API route handlers

## Engineering Details

### API Gateway Module

**Location**: `src/api-gateway/`

**Components**:

1. **Router** (`router.ts`)
   - Express router for `/api/verity` endpoint
   - Validates API key (`DF_MIDDLEWARE_API_KEY`)
   - Validates request format (endpoint, method)
   - Loads and validates API catalog
   - Verifies Clerk JWT tokens
   - Proxies requests to Verity API

   **Key Functions**:
   - `router.post("/")` - Proxy request handler
   - `router.get("/")` - API catalog endpoint
   - `validateApiKey(req)` - API key validation

   **File**: `src/api-gateway/router.ts:12-176`

2. **Proxy** (`proxy.ts`)
   - HTTP proxy to Verity API
   - Resolves dynamic route paths
   - Handles path parameters (`{id}`, `[id]`)
   - Converts API catalog paths to actual Verity routes
   - Builds query strings
   - Adds authentication headers

   **Key Functions**:
   - `proxyToVerity(request, baseUrl)` - Main proxy function
   - `resolveRoutePath(endpoint, params)` - Resolves dynamic routes
   - `buildQueryString(query)` - Builds query parameters

   **Path Conversions**:
   - `/apicalls/...` → `/api/calls/...`
   - `/apisms` → `/api/integrations/df-middleware/send-message`
   - `/apicomms/...` → `/api/comms/...`

   **File**: `src/api-gateway/proxy.ts:1-190`

3. **Registry** (`registry.ts`)
   - Loads Verity API catalog from JSON file
   - Validates endpoint existence
   - Provides endpoint metadata

   **Key Functions**:
   - `loadApiCatalog()` - Loads catalog from file
   - `validateEndpoint(catalog, endpoint, method)` - Validates endpoint
   - `getEndpoint(catalog, path, method)` - Gets endpoint info

   **File**: `src/api-gateway/registry.ts`

### MCP Server Module

**Location**: `src/mcp/`

**Components**:

1. **Server** (`server.ts`)
   - MCP server implementation over stdio
   - Handles `list_tools` and `call_tool` requests
   - Generates tools from API catalog
   - Manages Clerk authentication
   - Proxies tool calls to Verity API

   **Key Functions**:
   - `initializeCatalog()` - Loads API catalog and generates tools
   - `findEndpointFromToolName(toolName)` - Maps tool name to endpoint
   - Tool call handler - Processes MCP tool calls

   **Authentication**:
   - Uses `getClerkSessionToken()` for Clerk JWT
   - Auto-refreshes on 401 errors
   - Caches tokens for 55 minutes

   **File**: `src/mcp/server.ts:1-295`

2. **Tool Generator** (`tools/generator.ts`)
   - Generates MCP tools from API catalog
   - Creates tool names from endpoint paths
   - Generates tool descriptions from endpoint metadata
   - Creates parameter schemas from endpoint parameters

   **Tool Naming Convention**:
   - Pattern: `domain_resource_action` or `domain_resource_action_method`
   - Example: `comms_broadcasts_list` → `GET /api/comms/broadcasts`

   **File**: `src/mcp/tools/generator.ts`

3. **Enhanced Descriptions** (`tools/enhanced-descriptions.ts`)
   - Provides enhanced tool descriptions
   - Adds context and usage examples

   **File**: `src/mcp/tools/enhanced-descriptions.ts`

### Sync Library Module

**Location**: `src/lib/sync/`

**Components**:

1. **Contact Sync** (`contact-sync.ts`)
   - Bidirectional contact synchronization
   - Creates contact mappings
   - Handles conflict resolution
   - Updates contact metadata

   **File**: `src/lib/sync/contact-sync.ts`

2. **Call Sync** (`call-sync.ts`)
   - Syncs calls from Aloware to GHL
   - Creates call records in GHL
   - Links calls to contacts

   **File**: `src/lib/sync/call-sync.ts`

3. **Message Sync** (`communication-sync.ts`, `texting-to-ghl.ts`, `texting-to-aloware.ts`)
   - Syncs messages from texting system to GHL/Aloware
   - Creates message mappings
   - Handles conversation threading

   **Files**:
   - `src/lib/sync/communication-sync.ts`
   - `src/lib/sync/texting-to-ghl.ts`
   - `src/lib/sync/texting-to-aloware.ts`

4. **List Sync** (`list-sync.ts`)
   - Syncs agent-managed call lists
   - Creates/updates Aloware lists
   - Manages list memberships

   **File**: `src/lib/sync/list-sync.ts`

5. **DNC Sync** (`dnc-sync.ts`)
   - Syncs opt-out/opt-in status
   - Updates optout_registry
   - Propagates to GHL and Aloware

   **File**: `src/lib/sync/dnc-sync.ts`

6. **Recording/Transcription Sync** (`recording-sync.ts`, `transcription-sync.ts`)
   - Syncs call recordings and transcriptions
   - Links to call records

   **Files**:
   - `src/lib/sync/recording-sync.ts`
   - `src/lib/sync/transcription-sync.ts`

7. **Call Summary Sync** (`call-summary-sync.ts`)
   - Syncs call summaries and analytics

   **File**: `src/lib/sync/call-summary-sync.ts`

8. **Voicemail Sync** (`voicemail-sync.ts`)
   - Syncs voicemail messages

   **File**: `src/lib/sync/voicemail-sync.ts`

9. **GHL Contact Sync** (`ghl-contact-sync.ts`)
   - GHL-specific contact sync logic

   **File**: `src/lib/sync/ghl-contact-sync.ts`

10. **Utils** (`utils.ts`)
    - Shared sync utilities
    - Helper functions

    **File**: `src/lib/sync/utils.ts`

### GHL Integration Module

**Location**: `src/lib/ghl/`

**Components**:

1. **Client** (`client.ts`)
   - GoHighLevel API client
   - Supports Private Integration Token (PIT) and OAuth
   - Handles location scoping via query params
   - Error handling and logging

   **Key Functions**:
   - `ghlRequest<T>(endpoint, options, useOAuth)` - Main API request function
   - Location ID automatically added to query params (except specific endpoints)

   **Authentication**:
   - PIT: Uses `GHL_API_KEY` environment variable
   - OAuth: Uses `getGhlAccessToken(locationId)` for Marketplace App

   **File**: `src/lib/ghl/client.ts:1-365`

2. **Contacts** (`contacts.ts`)
   - Contact CRUD operations
   - Contact search and lookup

   **File**: `src/lib/ghl/contacts.ts`

3. **Conversations** (`conversations.ts`)
   - Conversation management
   - Message sending and retrieval

   **File**: `src/lib/ghl/conversations.ts`

4. **Tags** (`tags.ts`)
   - Tag management
   - Tag assignment

   **File**: `src/lib/ghl/tags.ts`

5. **OAuth Tokens** (`oauth-tokens.ts`)
   - OAuth token management
   - Token refresh
   - Token storage in database

   **File**: `src/lib/ghl/oauth-tokens.ts`

6. **Types** (`types.ts`)
   - TypeScript type definitions for GHL API

   **File**: `src/lib/ghl/types.ts`

### Aloware Integration Module

**Location**: `src/lib/aloware/`

**Components**:

1. **Client** (`client.ts`)
   - Aloware API client
   - API token authentication
   - Error handling

   **Key Functions**:
   - `alowareRequest<T>(endpoint, options)` - Main API request function
   - API token added to query params for GET requests
   - API token in body for POST/PUT requests

   **File**: `src/lib/aloware/client.ts:1-751`

2. **Call Lists** (`call-lists.ts`)
   - Call list management
   - List membership operations

   **File**: `src/lib/aloware/call-lists.ts`

3. **Lists** (`lists/`)
   - `applyMembership.ts` - Apply list membership
   - `ensureCallList.ts` - Ensure call list exists

   **Files**:
   - `src/lib/aloware/lists/applyMembership.ts`
   - `src/lib/aloware/lists/ensureCallList.ts`

4. **Sequences** (`sequences/`)
   - `enrollHandler.ts` - Sequence enrollment
   - `statusMapping.ts` - Status mapping

   **Files**:
   - `src/lib/aloware/sequences/enrollHandler.ts`
   - `src/lib/aloware/sequences/statusMapping.ts`

5. **Types** (`types.ts`)
   - TypeScript type definitions for Aloware API

   **File**: `src/lib/aloware/types.ts`

### Job Queue Module

**Location**: `src/lib/jobs/`

**Components**:

1. **Boss** (`boss.ts`)
   - pg-boss initialization and management
   - Queue name constants
   - Singleton pattern

   **Key Functions**:
   - `startBoss()` - Initialize and start pg-boss
   - `stopBoss()` - Stop pg-boss
   - `getBoss()` - Get boss instance

   **Queues**:
   - `WEBHOOK_EVENT_QUEUE` - "process-webhook-event"
   - `BROADCAST_EVENT_QUEUE` - "process-broadcast-event"

   **File**: `src/lib/jobs/boss.ts:1-57`

### Webhook Handlers Module

**Location**: `src/app/api/webhooks/`

**Components**:

1. **GHL Webhook** (`ghl/route.ts`)
   - Handles GHL webhook events
   - Validates webhook signature (if configured)
   - Creates dedupe key
   - Inserts webhook event
   - Enqueues job

   **File**: `src/app/api/webhooks/ghl/route.ts`

2. **Aloware Webhook** (`aloware/route.ts`)
   - Handles Aloware webhook events
   - Validates basic auth
   - Creates dedupe key
   - Inserts webhook event
   - Enqueues job

   **File**: `src/app/api/webhooks/aloware/route.ts`

3. **Texting Webhook** (`texting/route.ts`)
   - Handles texting system webhook events
   - Creates dedupe key
   - Inserts texting webhook event
   - Enqueues job

   **File**: `src/app/api/webhooks/texting/route.ts`

4. **Broadcast Webhook** (`broadcast/route.ts`)
   - Handles Verity broadcast webhook events
   - Creates dedupe key
   - Inserts broadcast webhook event
   - Enqueues job

   **File**: `src/app/api/webhooks/broadcast/route.ts`

5. **GHL Provider Delivery** (`ghl/provider-delivery/route.ts`)
   - Handles GHL provider delivery webhooks
   - For Marketplace App provider events

   **File**: `src/app/api/webhooks/ghl/provider-delivery/route.ts`

### Admin Module

**Location**: `src/app/api/admin/`

**Components**:

1. **Events** (`events/route.ts`, `events/[id]/`)
   - List webhook events
   - Mark event as done
   - Quarantine event
   - Replay event

   **Files**:
   - `src/app/api/admin/events/route.ts`
   - `src/app/api/admin/events/[id]/mark-done/route.ts`
   - `src/app/api/admin/events/[id]/quarantine/route.ts`
   - `src/app/api/admin/events/[id]/replay/route.ts`

2. **Agents** (`agents/seed/route.ts`)
   - Seed agent directory
   - Initialize agent mappings

   **File**: `src/app/api/admin/agents/seed/route.ts`

3. **Lists** (`lists/rebuild/route.ts`, `lists/status/route.ts`)
   - Rebuild call lists
   - Get list status

   **Files**:
   - `src/app/api/admin/lists/rebuild/route.ts`
   - `src/app/api/admin/lists/status/route.ts`

4. **Mappings** (`mappings/repair/route.ts`)
   - Repair contact mappings
   - Fix mapping inconsistencies

   **File**: `src/app/api/admin/mappings/repair/route.ts`

5. **Texting** (`texting/events/route.ts`)
   - List texting webhook events

   **File**: `src/app/api/admin/texting/events/route.ts`

### Job Processing Module

**Location**: `src/app/api/jobs/`

**Components**:

1. **Process Pending** (`process-pending/route.ts`)
   - Cron job endpoint (every 5 minutes)
   - Processes pending webhook events
   - Processes pending broadcast events

   **File**: `src/app/api/jobs/process-pending/route.ts`

2. **Enqueue Pending** (`enqueue-pending/route.ts`)
   - Manually enqueue pending webhook events

   **File**: `src/app/api/jobs/enqueue-pending/route.ts`

3. **Enqueue Texting Pending** (`enqueue-texting-pending/route.ts`)
   - Manually enqueue pending texting events

   **File**: `src/app/api/jobs/enqueue-texting-pending/route.ts`

4. **Run Once** (`run-once/route.ts`)
   - Run job once (for testing)

   **File**: `src/app/api/jobs/run-once/route.ts`

### Sync Module

**Location**: `src/app/api/sync/`

**Components**:

1. **Contacts** (`contacts/route.ts`)
   - Manual contact sync trigger
   - Syncs contacts between GHL and Aloware

   **File**: `src/app/api/sync/contacts/route.ts`

2. **Lists** (`lists/route.ts`)
   - Manual list sync trigger
   - Syncs call lists

   **File**: `src/app/api/sync/lists/route.ts`

### Agent Management Module

**Location**: `src/lib/agents/`

**Components**:

1. **Detect Reassignment** (`detectReassignment.ts`)
   - Detects agent reassignment
   - Compares current vs. previous agent

   **File**: `src/lib/agents/detectReassignment.ts`

2. **Resolve Agent** (`resolveAgent.ts`)
   - Resolves agent key from GHL contact
   - Checks agent directory
   - Matches tags and custom fields

   **File**: `src/lib/agents/resolveAgent.ts`

3. **Seed** (`seed.ts`)
   - Seeds agent directory
   - Initializes agent mappings

   **File**: `src/lib/agents/seed.ts`

### Broadcast Module

**Location**: `src/lib/broadcasts/`

**Components**:

1. **Router** (`router.ts`)
   - Broadcast event routing
   - Determines sync action

   **File**: `src/lib/broadcasts/router.ts`

2. **Sync to GHL** (`sync-to-ghl.ts`)
   - Syncs broadcast analytics to GHL
   - Updates contact tags/custom fields

   **File**: `src/lib/broadcasts/sync-to-ghl.ts`

3. **Find Broadcasts by Contact** (`find-broadcasts-by-contact.ts`)
   - Finds broadcasts for a contact
   - Queries Verity database

   **File**: `src/lib/broadcasts/find-broadcasts-by-contact.ts`

4. **Get Broadcast Name** (`get-broadcast-name.ts`)
   - Gets broadcast name from Verity

   **File**: `src/lib/broadcasts/get-broadcast-name.ts`

5. **Calculate Analytics** (`calculate-analytics.ts`)
   - Calculates broadcast analytics
   - Aggregates metrics

   **File**: `src/lib/broadcasts/calculate-analytics.ts`

6. **Verity DB** (`verity-db.ts`)
   - Direct Verity database queries
   - For broadcast data

   **File**: `src/lib/broadcasts/verity-db.ts`

7. **Types** (`types.ts`)
   - TypeScript type definitions

   **File**: `src/lib/broadcasts/types.ts`

### Compliance Module

**Location**: `src/lib/compliance/`

**Components**:

1. **SMS Opt-Out** (`smsOptOut.ts`)
   - Handles SMS opt-out requests
   - Updates optout_registry
   - Propagates to GHL and Aloware

   **File**: `src/lib/compliance/smsOptOut.ts`

### Conflicts Module

**Location**: `src/lib/conflicts/`

**Components**:

1. **Merge** (`merge.ts`)
   - Merges conflicting contact data
   - Applies merge rules

   **File**: `src/lib/conflicts/merge.ts`

2. **Rules** (`rules.ts`)
   - Conflict resolution rules
   - Source of truth configuration

   **File**: `src/lib/conflicts/rules.ts`

### Lists Module

**Location**: `src/lib/lists/`

**Components**:

1. **Resolve List Intent** (`resolveListIntent.ts`)
   - Resolves list intent from agent key and list key
   - Maps to Aloware list ID

   **File**: `src/lib/lists/resolveListIntent.ts`

### Loops Module

**Location**: `src/lib/loops/`

**Components**:

1. **Origin** (`origin.ts`)
   - Determines origin of data
   - Tracks data source

   **File**: `src/lib/loops/origin.ts`

### Reconcile Module

**Location**: `src/lib/reconcile/`

**Components**:

1. **Contacts** (`contacts.ts`)
   - Reconciliation of contacts
   - Batch processing
   - Cursor management

   **File**: `src/lib/reconcile/contacts.ts`

### Texting Module

**Location**: `src/lib/texting/`

**Components**:

1. **Client** (`client.ts`)
   - Texting system API client
   - Message sending

   **File**: `src/lib/texting/client.ts`

2. **Router** (`router.ts`)
   - Texting event routing
   - Determines sync action

   **File**: `src/lib/texting/router.ts`

3. **Normalize** (`normalize.ts`)
   - Normalizes texting events
   - Standardizes format

   **File**: `src/lib/texting/normalize.ts`

4. **Jobs** (`jobs.ts`)
   - Texting job processing
   - Event handling

   **File**: `src/lib/texting/jobs.ts`

5. **Types** (`types.ts`)
   - TypeScript type definitions

   **File**: `src/lib/texting/types.ts`

### Events Module

**Location**: `src/lib/events/`

**Components**:

1. **Router** (`router.ts`)
   - Event routing
   - Determines processing action

   **File**: `src/lib/events/router.ts`

### Authentication Module

**Location**: `src/auth/`

**Components**:

1. **Clerk Token Manager** (`clerk-token-manager.ts`)
   - Manages Clerk session tokens
   - Token caching and refresh
   - Used by MCP server

   **Key Functions**:
   - `getClerkSessionToken()` - Gets valid token (cached or fresh)
   - `clearCachedToken()` - Clears cache

   **File**: `src/auth/clerk-token-manager.ts:1-134`

2. **Verity Auth** (`verity-auth.ts`)
   - Clerk JWT verification (placeholder)
   - Token extraction
   - Auth level checking

   **Note**: Implementation is placeholder (see file comments)

   **File**: `src/auth/verity-auth.ts:1-78`

### Database Module

**Location**: `src/server/db/`

**Components**:

1. **Schema** (`schema.ts`)
   - Drizzle ORM schema definitions
   - Table definitions
   - Indexes and constraints

   **File**: `src/server/db/schema.ts:1-397`

2. **Index** (`index.ts`)
   - Database connection
   - Drizzle instance

   **File**: `src/server/db/index.ts`

3. **Migrations** (`migrations/`)
   - SQL migration files
   - Drizzle migration metadata

   **Location**: `src/server/db/migrations/`

### Worker Script

**Location**: `src/scripts/worker.ts`

**Purpose**: Processes jobs from pg-boss queue

**Responsibilities**:
- Processes webhook events
- Processes broadcast events
- Calls sync library functions
- Updates event status
- Logs sync operations

**File**: `src/scripts/worker.ts`

### Module Dependencies

```
api-gateway/
  ├─► proxy.ts (uses Verity API)
  ├─► registry.ts (loads API catalog)
  └─► router.ts (uses proxy, registry, auth)

mcp/
  ├─► server.ts (uses api-gateway, auth)
  └─► tools/ (uses registry)

lib/sync/
  ├─► Uses lib/ghl/
  ├─► Uses lib/aloware/
  └─► Uses server/db/

lib/ghl/
  └─► Uses server/db/ (for OAuth tokens)

lib/aloware/
  └─► Uses server/db/

app/api/
  ├─► Uses lib/jobs/
  ├─► Uses lib/sync/
  └─► Uses server/db/
```
