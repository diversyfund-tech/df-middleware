# Security and Compliance

## Executive Summary

DF-Middleware handles sensitive data including contact information, messages, and authentication tokens. Security measures include API key validation, webhook signature verification (optional), Clerk JWT authentication, and secure token storage. Compliance features include SMS opt-out registry and audit logging.

**Security Controls:**
- API key authentication for middleware-to-middleware communication
- Clerk JWT tokens for Verity API access
- Webhook signature verification (optional)
- Secure token storage in database
- Deduplication to prevent replay attacks
- Audit logging via sync_log table

## Engineering Details

### Authentication

#### API Gateway Authentication

**Method**: API key validation

**Header**: `Authorization: Bearer <DF_MIDDLEWARE_API_KEY>`

**Validation**: `src/api-gateway/router.ts:19-34`

**Environment Variable**: `DF_MIDDLEWARE_API_KEY`

**Usage**: Required for `/api/verity` endpoint

**File**: `src/api-gateway/router.ts:19-34`

#### Clerk Authentication (MCP Server)

**Method**: Clerk session token (JWT)

**Token Management**: `src/auth/clerk-token-manager.ts`

**Flow**:
1. Gets first available user from Clerk
2. Gets user's first session
3. Creates session token via Clerk API
4. Caches token for 55 minutes
5. Auto-refreshes on 401 errors

**Token Caching**:
- In-memory cache (lost on restart)
- Expires 5 minutes before actual expiration
- Prevents concurrent refresh requests

**File**: `src/auth/clerk-token-manager.ts:1-134`

**Environment Variable**: `CLERK_SECRET_KEY` (required)

#### Clerk JWT Verification (Placeholder)

**Status**: Placeholder implementation

**File**: `src/auth/verity-auth.ts:35-56`

**TODO**: Implement Clerk SDK JWT verification

**Current Behavior**: Throws error if called

#### Verity API Authentication

**Method**: Clerk JWT token passed as `Authorization: Bearer <token>` header

**Usage**: 
- MCP server: Uses `getClerkSessionToken()`
- API gateway: Extracts from request headers

**File**: `src/api-gateway/proxy.ts:111-113`, `src/mcp/server.ts:211-217`

### Authorization

#### Admin Endpoints

**Method**: API key validation (`DF_ADMIN_SECRET`)

**Endpoints**:
- `/api/admin/*` - All admin endpoints
- `/api/jobs/*` - Job processing endpoints

**Validation**: Check `Authorization` header matches `DF_ADMIN_SECRET`

**File**: Various admin route handlers

#### Webhook Endpoints

**Method**: Optional signature verification

**GHL Webhooks**:
- Secret: `GHL_WEBHOOK_SECRET` (optional)
- Validation: Not currently implemented

**Aloware Webhooks**:
- Method: Basic Auth
- Username: `ALOWARE_WEBHOOK_BASIC_USER`
- Password: `ALOWARE_WEBHOOK_BASIC_PASS`

**Texting Webhooks**:
- Secret: `VERITY_WEBHOOK_SECRET` (optional)
- Validation: Not currently implemented

**Broadcast Webhooks**:
- Secret: `VERITY_WEBHOOK_SECRET` (optional)
- Validation: Not currently implemented

### Secrets Management

#### Environment Variables

**Storage**: Vercel environment variables (production) or `.env` file (local)

**Validation**: `env.mjs` uses `@t3-oss/env-nextjs` for schema validation

**File**: `env.mjs:1-137`

#### Database Token Storage

**Table**: `ghl_oauth_tokens`

**Columns**:
- `access_token` - OAuth access token (encrypted at rest by database)
- `refresh_token` - OAuth refresh token (encrypted at rest by database)
- `expires_at` - Token expiration timestamp

**Security**: Tokens stored as plain text (rely on database encryption)

**File**: `src/server/db/schema.ts:377-394`

#### In-Memory Token Cache

**Location**: `src/auth/clerk-token-manager.ts`

**Storage**: In-memory variable (`cachedToken`)

**Security**: 
- Lost on restart (forces refresh)
- Not persisted to disk
- Single process (not shared across instances)

**File**: `src/auth/clerk-token-manager.ts:18-19`

### Data Protection

#### Webhook Payload Storage

**Table**: `webhook_events.payload_json`, `texting_webhook_events.payload_json`, `broadcast_webhook_events.payload_json`

**Type**: JSONB (PostgreSQL)

**Security**: 
- Stored as-is (no encryption)
- Rely on database encryption at rest
- May contain sensitive contact/message data

**File**: `src/server/db/schema.ts:25,132,159`

#### Contact Data

**Storage**: 
- `contact_mappings` - Contact ID mappings
- `message_mappings` - Message ID mappings
- Webhook payloads contain full contact data

**Security**: 
- No encryption at application level
- Rely on database encryption at rest
- Phone numbers and emails stored as plain text

**File**: `src/server/db/schema.ts:90-115,177-207`

### Compliance

#### SMS Opt-Out Registry

**Table**: `optout_registry`

**Purpose**: Authoritative do-not-text list with audit trail

**Columns**:
- `phone_number` - Phone number in E.164 format
- `status` - 'opted_out' | 'opted_in'
- `source` - 'texting' | 'ghl' | 'manual'
- `reason` - 'STOP' | 'HELP' | 'other'
- `last_event_at` - When last opt-out/in event occurred

**Compliance**: 
- TCPA compliance (do-not-text list)
- Audit trail for opt-out/in events
- Source tracking for compliance reporting

**File**: `src/server/db/schema.ts:213-229`, `src/lib/compliance/smsOptOut.ts`

#### Audit Logging

**Table**: `sync_log`

**Purpose**: Tracks all sync operations for audit and debugging

**Columns**:
- `direction` - Sync direction
- `entity_type` - Entity type
- `entity_id` - Entity identifier
- `source_id` - Source system ID
- `target_id` - Target system ID
- `status` - 'success' | 'error'
- `started_at` - When sync started
- `finished_at` - When sync finished
- `error_message` - Error message if failed
- `correlation_id` - Links to webhook event

**Compliance**: 
- Complete audit trail of data sync operations
- Error tracking for compliance reporting
- Correlation to source events

**File**: `src/server/db/schema.ts:44-65`

### Webhook Security

#### Deduplication

**Method**: `dedupe_key` unique index

**Purpose**: Prevents duplicate processing (replay attacks)

**Implementation**:
- GHL/Aloware: `source + eventType + entityId`
- Texting: `eventType + conversationId + entityId`
- Broadcast: `broadcastId + eventType + timestamp`

**File**: `src/server/db/schema.ts:32,139,166`

#### Signature Verification

**Status**: Optional (not enforced)

**GHL**: `GHL_WEBHOOK_SECRET` (not validated)

**Aloware**: Basic Auth (validated)

**Texting**: `VERITY_WEBHOOK_SECRET` (not validated)

**Broadcast**: `VERITY_WEBHOOK_SECRET` (not validated)

**Recommendation**: Implement signature verification for all webhooks

### Network Security

#### HTTPS

**Production**: Vercel provides HTTPS for all endpoints

**Development**: HTTP (localhost)

**Recommendation**: Use HTTPS in all environments

#### CORS

**Configuration**: `cors()` middleware in Express server

**File**: `src/index.ts:17`

**Current**: Allows all origins (development)

**Recommendation**: Restrict CORS in production

### Error Handling Security

#### Error Messages

**Current**: Error messages may expose internal details

**Example**: `src/api-gateway/proxy.ts:138-156`

**Recommendation**: Sanitize error messages in production

#### Logging

**Current**: Console logging may expose sensitive data

**Example**: `src/lib/ghl/client.ts:50,82-98`

**Recommendation**: Use structured logging with sensitive data redaction

### Token Security

#### Clerk Token Expiration

**Duration**: 1 hour (3600 seconds)

**Cache Duration**: 55 minutes (expires 5 minutes early)

**Refresh**: Auto-refreshes on 401 errors

**File**: `src/auth/clerk-token-manager.ts:96,115`

#### OAuth Token Expiration

**Storage**: `ghl_oauth_tokens.expires_at`

**Refresh**: Via `refresh_token` (not fully implemented)

**File**: `src/lib/ghl/oauth-tokens.ts`

### Database Security

#### Connection String

**Environment Variable**: `DATABASE_URL`

**Format**: PostgreSQL connection string

**Security**: 
- Contains credentials
- Should be encrypted in transit
- Should be stored securely

#### Access Control

**Current**: Database access via connection string

**Recommendation**: 
- Use connection pooling
- Implement least-privilege access
- Use read replicas for queries
- Use separate credentials for different operations

### Known Security Gaps

1. **Clerk JWT Verification**: Placeholder implementation (see `src/auth/verity-auth.ts:35-56`)
2. **Webhook Signatures**: Not validated (optional configuration)
3. **Error Messages**: May expose internal details
4. **Token Storage**: Plain text in database (rely on database encryption)
5. **CORS**: Allows all origins (development only)
6. **Logging**: May log sensitive data
7. **OAuth Refresh**: Not fully implemented

### Security Recommendations

1. **Implement Clerk JWT Verification**: Complete `verifyAuthToken()` function
2. **Validate Webhook Signatures**: Implement signature verification for all webhooks
3. **Sanitize Error Messages**: Remove internal details in production
4. **Structured Logging**: Use logging library with sensitive data redaction
5. **Restrict CORS**: Configure allowed origins in production
6. **Token Encryption**: Consider encrypting tokens at application level
7. **Rate Limiting**: Implement rate limiting for API endpoints
8. **Input Validation**: Validate all webhook payloads
9. **SQL Injection Prevention**: Use parameterized queries (Drizzle ORM handles this)
10. **Secrets Rotation**: Implement secrets rotation policy
