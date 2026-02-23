# Integrations

## Executive Summary

DF-Middleware integrates with four primary external systems: GoHighLevel (GHL) for CRM, Aloware for power dialer, Verity for capital management, and a proprietary texting system. All integrations use REST APIs with authentication via API keys, OAuth tokens, or JWT tokens.

**Integration Types:**
- **GHL**: Private Integration Token (PIT) + OAuth for Marketplace App
- **Aloware**: API token authentication
- **Verity**: Clerk JWT token via API gateway proxy
- **Texting System**: Webhook-based integration

## Engineering Details

### GoHighLevel (GHL) Integration

**Purpose**: CRM platform for contact management, conversations, and tags

**Authentication Methods**:
1. **Private Integration Token (PIT)** - Default method
   - Uses `GHL_API_KEY` environment variable
   - Added as `Authorization: Bearer <token>` header
   - Used for most API calls

2. **OAuth (Marketplace App)** - For provider-related calls
   - Uses `getGhlAccessToken(locationId)` function
   - Tokens stored in `ghl_oauth_tokens` table
   - Auto-refreshed when expired
   - Required for conversation provider operations

**Base URL**: `https://services.leadconnectorhq.com` (configurable via `GHL_BASE_URL`)

**Location Scoping**: 
- Location ID added as `locationId` query parameter
- Exceptions: `/free-slots`, `/conversations/messages/inbound`, `/conversations/messages/outbound`, `/conversations` POST

**API Version**: `2021-07-28` (via `Version` header)

**Key Endpoints Used**:
- Contacts: `/contacts`, `/contacts/{id}`
- Conversations: `/conversations`, `/conversations/{id}/messages`
- Tags: `/tags`
- Owners: `/owners`

**Client Location**: `src/lib/ghl/client.ts`

**Key Functions**:
- `ghlRequest<T>(endpoint, options, useOAuth)` - Main API request function
- `getGhlAccessToken(locationId)` - Gets OAuth token (from `src/lib/ghl/oauth-tokens.ts`)

**OAuth Token Management**:
- Tokens stored in `ghl_oauth_tokens` table
- Keyed by `location_id`
- Auto-refreshed via `refreshToken` when expired
- Expires at `expires_at` timestamp

**File**: `src/lib/ghl/client.ts:1-365`, `src/lib/ghl/oauth-tokens.ts`

**Webhook Configuration**:
- Webhook endpoint: `/api/webhooks/ghl`
- Webhook secret: `GHL_WEBHOOK_SECRET` (optional)
- Provider delivery endpoint: `/api/webhooks/ghl/provider-delivery`

**File**: `src/app/api/webhooks/ghl/route.ts`

### Aloware Integration

**Purpose**: Power dialer and call management system

**Authentication**: API token authentication
- Uses `ALOWARE_API_TOKEN` environment variable
- For GET requests: Token added to query params (`?api_token=...`)
- For POST/PUT requests: Token added to request body

**Base URL**: `https://app.aloware.com/api/v1`

**Key Endpoints Used**:
- Contacts: `/webhook/contacts`, `/webhook/contacts/{id}`
- Calls: `/webhook/calls`
- Lists: `/webhook/lists`, `/webhook/lists/{id}/contacts`
- Users: `/webhook/users`
- Sequences: `/webhook/sequences` (if enabled)

**Client Location**: `src/lib/aloware/client.ts`

**Key Functions**:
- `alowareRequest<T>(endpoint, options)` - Main API request function
- `getUsers()` - Fetch users
- `getContact(contactId, phoneNumber?)` - Get contact (requires phone number)
- `searchContacts(query)` - Search contacts
- `createContact(contact)` - Create contact
- `updateContact(contactId, contact)` - Update contact
- `getCallLists()` - Get call lists
- `addContactToList(listId, contactId)` - Add contact to list
- `removeContactFromList(listId, contactId)` - Remove contact from list

**File**: `src/lib/aloware/client.ts:1-751`

**Webhook Configuration**:
- Webhook endpoint: `/api/webhooks/aloware`
- Basic Auth: `ALOWARE_WEBHOOK_BASIC_USER` / `ALOWARE_WEBHOOK_BASIC_PASS`
- Allowed events: `ALOWARE_WEBHOOK_ALLOWED_EVENTS` (optional)

**File**: `src/app/api/webhooks/aloware/route.ts`

**Sequence Integration**:
- Feature flag: `ENABLE_ALOWARE_SEQUENCES` (default: 'false')
- Status mapping: `ALOWARE_STATUS_TO_SEQUENCE` (JSON string)
- Enrollment handler: `src/lib/aloware/sequences/enrollHandler.ts`

### Verity Integration

**Purpose**: Capital management platform API proxy

**Authentication**: Clerk JWT token
- Token obtained via `getClerkSessionToken()` (MCP server)
- Or passed via `Authorization` header (API gateway)
- Token verified via Clerk SDK (placeholder implementation)

**Base URL**: Configurable via `VERITY_BASE_URL` (default: `http://localhost:3000`)

**Integration Methods**:

1. **API Gateway** (`/api/verity`)
   - Express router: `src/api-gateway/router.ts`
   - Validates API key: `DF_MIDDLEWARE_API_KEY`
   - Proxies requests to Verity API
   - Path conversions:
     - `/apicalls/...` → `/api/calls/...`
     - `/apisms` → `/api/integrations/df-middleware/send-message`
     - `/apicomms/...` → `/api/comms/...`

2. **MCP Server**
   - Exposes Verity API endpoints as MCP tools
   - Dynamically generates tools from API catalog
   - Uses Clerk session tokens for authentication
   - Auto-refreshes tokens on 401 errors

**API Catalog**:
- Loaded from JSON file (path: `VERITY_CATALOG_PATH`)
- Contains endpoint metadata (path, methods, parameters)
- Used for tool generation and validation

**File**: `src/api-gateway/proxy.ts`, `src/api-gateway/router.ts`, `src/mcp/server.ts`

**Direct Database Access** (for broadcasts):
- Database URL: `VERITY_DATABASE_URL`
- Used for querying broadcast data directly
- File: `src/lib/broadcasts/verity-db.ts`

**Webhook Configuration**:
- Broadcast webhook endpoint: `/api/webhooks/broadcast`
- Webhook secret: `VERITY_WEBHOOK_SECRET` (optional)

**File**: `src/app/api/webhooks/broadcast/route.ts`

### Texting System Integration

**Purpose**: Proprietary SMS system integrated with Verity

**Integration Method**: Webhook-based

**Webhook Endpoint**: `/api/webhooks/texting`

**Webhook Secret**: `VERITY_WEBHOOK_SECRET` (optional)

**Event Types**:
- Message received
- Message sent
- Delivery status
- Opt-out requests

**Processing Flow**:
1. Webhook received → `texting_webhook_events` table
2. Job worker processes event
3. Syncs message to GHL (if contact exists)
4. Syncs message to Aloware (if contact exists)
5. Creates `message_mappings` entry

**Sync Configuration**:
- Feature flag: `TEXTING_SYNC_TO_ALOWARE` (optional)
- Controls whether messages sync to Aloware

**File**: `src/app/api/webhooks/texting/route.ts`, `src/lib/sync/texting-to-ghl.ts`, `src/lib/sync/texting-to-aloware.ts`

**Client** (for sending messages):
- File: `src/lib/texting/client.ts`
- Sends messages via Verity API proxy

### Integration Patterns

#### Webhook Processing Pattern

```
External System Webhook
    │
    ▼
Next.js API Route Handler
    │
    ├─► Validate Webhook Signature (if configured)
    │
    ├─► Create Dedupe Key
    │
    ├─► Check for Duplicate (database lookup)
    │
    ├─► Insert Webhook Event (status: 'pending')
    │
    ▼
Enqueue Job (pg-boss)
    │
    ▼
Job Worker Processes Event
    │
    ├─► Determine Sync Direction
    │
    ├─► Call Sync Library Function
    │
    ├─► Update Event Status
    │
    ├─► Log Sync Operation
    │
    ▼
Complete
```

#### API Proxy Pattern

```
Client Request
    │
    ▼
API Gateway Router
    │
    ├─► Validate API Key
    │
    ├─► Validate Request Format
    │
    ├─► Extract Auth Token
    │
    ├─► Verify Auth Token
    │
    ▼
Proxy Function
    │
    ├─► Resolve Route Path
    │
    ├─► Build Query String
    │
    ├─► Add Auth Header
    │
    ▼
External API
    │
    ▼
Response
```

#### Sync Pattern

```
Source System Event
    │
    ▼
Check Mapping (contact_mappings / message_mappings)
    │
    ├─► If exists: Update target system
    │
    ├─► If not exists: Create in target system, Create mapping
    │
    ▼
Update Sync Log
    │
    ▼
Complete
```

### Error Handling

#### GHL API Errors

- **401 Unauthorized**: Invalid API key or OAuth token expired
- **404 Not Found**: Resource doesn't exist
- **429 Rate Limited**: Too many requests (retry with backoff)
- **500 Server Error**: GHL API error (log and retry)

**Error Handling**: `src/lib/ghl/client.ts:80-100`

#### Aloware API Errors

- **401 Unauthorized**: Invalid API token
- **404 Not Found**: Resource doesn't exist
- **500 Server Error**: Aloware API error (log and retry)

**Error Handling**: `src/lib/aloware/client.ts:44-56`

#### Verity API Errors

- **401 Unauthorized**: Invalid Clerk token (auto-refresh and retry)
- **404 Not Found**: Endpoint doesn't exist
- **500 Server Error**: Verity API error (log and return)

**Error Handling**: `src/api-gateway/proxy.ts:138-156`, `src/mcp/server.ts:232-256`

### Rate Limiting

**GHL**: 
- Rate limits not explicitly handled
- Consider implementing exponential backoff

**Aloware**:
- Rate limits not explicitly handled
- Consider implementing exponential backoff

**Verity**:
- Rate limits not explicitly handled
- Consider implementing exponential backoff

### Retry Logic

**Job Queue** (pg-boss):
- Retry limit: 10
- Retry delay: 60 seconds
- Retry backoff: enabled

**File**: `src/lib/jobs/boss.ts:14-19`

**MCP Server**:
- Auto-retries on 401 with token refresh
- Single retry attempt

**File**: `src/mcp/server.ts:232-256`

### Webhook Deduplication

All webhooks use `dedupe_key` for deduplication:

- **GHL/Aloware**: `source + eventType + entityId`
- **Texting**: `eventType + conversationId + entityId`
- **Broadcast**: `broadcastId + eventType + timestamp`

Unique database indexes prevent duplicate processing.

### Integration Configuration

**Environment Variables** (see `11-appendix-glossary.md`):

**GHL**:
- `GHL_API_KEY` - Private Integration Token
- `GHL_LOCATION_ID` - Location identifier
- `GHL_CALENDAR_ID` - Calendar identifier
- `GHL_BASE_URL` - API base URL (optional)
- `GHL_WEBHOOK_SECRET` - Webhook signature secret (optional)
- `GHL_CONVERSATION_PROVIDER_ID` - Provider ID for historical imports (optional)
- `GHL_CLIENT_ID` - OAuth client ID (optional)
- `GHL_CLIENT_SECRET` - OAuth client secret (optional)

**Aloware**:
- `ALOWARE_API_TOKEN` - API authentication token
- `ALOWARE_WEBHOOK_BASIC_USER` - Webhook basic auth username
- `ALOWARE_WEBHOOK_BASIC_PASS` - Webhook basic auth password
- `ALOWARE_WEBHOOK_ALLOWED_EVENTS` - Allowed webhook events (optional)

**Verity**:
- `VERITY_BASE_URL` - API base URL (optional)
- `VERITY_API_KEY` - API key (optional)
- `VERITY_WEBHOOK_SECRET` - Webhook signature secret (optional)
- `VERITY_DATABASE_URL` - Database connection (optional)
- `VERITY_CATALOG_PATH` - API catalog JSON file path (optional)
- `CLERK_SECRET_KEY` - Clerk secret key (required for MCP)

**Texting**:
- `TEXTING_SYNC_TO_ALOWARE` - Enable Aloware sync (optional)

### Known Integration Limitations

1. **GHL OAuth**: Token refresh not fully implemented (see `src/lib/ghl/oauth-tokens.ts`)
2. **Clerk Auth**: Verification is placeholder (see `src/auth/verity-auth.ts:35-56`)
3. **Rate Limiting**: No explicit rate limit handling
4. **Webhook Signatures**: Optional validation (not enforced)
5. **Error Recovery**: Limited retry logic for API failures
