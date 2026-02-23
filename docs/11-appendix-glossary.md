# Appendix: Glossary and Configuration Reference

## Glossary

### Terms

**API Gateway**: Express router that proxies requests to Verity API

**MCP Server**: Model Context Protocol server that exposes Verity API endpoints as tools

**Webhook Event**: Incoming event from external system (GHL, Aloware, texting)

**Sync Operation**: Bidirectional synchronization between GHL and Aloware

**Contact Mapping**: Database record mapping contact IDs between systems

**Message Mapping**: Database record mapping message IDs between systems

**Dedupe Key**: Unique key for webhook event deduplication

**Agent Key**: Identifier for agent (e.g., 'CHRIS', 'RAFI', 'UNASSIGNED')

**List Key**: Identifier for call list (e.g., 'CALL_NOW', 'NEW_LEADS')

**PIT**: Private Integration Token (GHL authentication method)

**OAuth**: OAuth 2.0 authentication (GHL Marketplace App)

**Clerk JWT**: Clerk session token for Verity API authentication

**pg-boss**: PostgreSQL-based job queue

**Drizzle ORM**: Type-safe SQL ORM for PostgreSQL

### Acronyms

- **GHL**: GoHighLevel (CRM platform)
- **MCP**: Model Context Protocol
- **JWT**: JSON Web Token
- **API**: Application Programming Interface
- **REST**: Representational State Transfer
- **HTTP**: Hypertext Transfer Protocol
- **HTTPS**: HTTP Secure
- **CORS**: Cross-Origin Resource Sharing
- **SSL/TLS**: Secure Sockets Layer / Transport Layer Security
- **TCPA**: Telephone Consumer Protection Act
- **DNC**: Do Not Call
- **SMS**: Short Message Service
- **JSON**: JavaScript Object Notation
- **JSONB**: JSON Binary (PostgreSQL type)
- **UUID**: Universally Unique Identifier
- **E.164**: International phone number format
- **CI/CD**: Continuous Integration / Continuous Deployment
- **APM**: Application Performance Monitoring

## Configuration Reference

### Environment Variables

#### Database

**`DATABASE_URL`** (required)
- Type: `string` (PostgreSQL connection string)
- Format: `postgresql://user:password@host:5432/database`
- Purpose: PostgreSQL database connection
- Example: `postgresql://postgres:password@localhost:5432/df_middleware`

#### GoHighLevel (GHL)

**`GHL_API_KEY`** (required)
- Type: `string`
- Purpose: Private Integration Token (PIT) for GHL API
- Example: `sk_live_...`

**`GHL_LOCATION_ID`** (required)
- Type: `string`
- Purpose: GHL location identifier
- Example: `location_123`

**`GHL_CALENDAR_ID`** (required)
- Type: `string`
- Purpose: GHL calendar identifier
- Example: `calendar_123`

**`GHL_BASE_URL`** (optional)
- Type: `string` (URL)
- Default: `https://services.leadconnectorhq.com`
- Purpose: GHL API base URL
- Example: `https://services.leadconnectorhq.com`

**`GHL_WEBHOOK_SECRET`** (optional)
- Type: `string`
- Purpose: Webhook signature secret for validation
- Example: `webhook_secret_123`

**`GHL_CONVERSATION_PROVIDER_ID`** (optional)
- Type: `string`
- Purpose: Provider ID for historical message imports
- Example: `provider_123`

**`GHL_CLIENT_ID`** (optional)
- Type: `string`
- Purpose: OAuth client ID for Marketplace App
- Example: `client_123`

**`GHL_CLIENT_SECRET`** (optional)
- Type: `string`
- Purpose: OAuth client secret for Marketplace App
- Example: `client_secret_123`

#### Aloware

**`ALOWARE_API_TOKEN`** (required)
- Type: `string`
- Purpose: Aloware API authentication token
- Example: `api_token_123`

**`ALOWARE_WEBHOOK_BASIC_USER`** (required)
- Type: `string`
- Purpose: Basic auth username for webhook endpoint
- Example: `webhook_user`

**`ALOWARE_WEBHOOK_BASIC_PASS`** (required)
- Type: `string`
- Purpose: Basic auth password for webhook endpoint
- Example: `webhook_pass`

**`ALOWARE_WEBHOOK_ALLOWED_EVENTS`** (optional)
- Type: `string`
- Purpose: Comma-separated list of allowed webhook events
- Example: `contact.updated,call.completed`

#### Verity

**`VERITY_BASE_URL`** (optional)
- Type: `string` (URL)
- Default: `http://localhost:3000`
- Purpose: Verity API base URL
- Example: `https://verity.example.com`

**`VERITY_API_KEY`** (optional)
- Type: `string`
- Purpose: Verity API key (if needed)
- Example: `api_key_123`

**`VERITY_WEBHOOK_SECRET`** (optional)
- Type: `string`
- Purpose: Webhook signature secret for validation
- Example: `webhook_secret_123`

**`VERITY_DATABASE_URL`** (optional)
- Type: `string` (URL)
- Purpose: Verity database connection (for direct queries)
- Example: `postgresql://user:pass@host:5432/verity`

**`VERITY_CATALOG_PATH`** (optional)
- Type: `string`
- Purpose: Path to Verity API catalog JSON file
- Example: `./verity-catalog.json`

#### Clerk

**`CLERK_SECRET_KEY`** (required)
- Type: `string`
- Purpose: Clerk secret key for JWT verification
- Example: `sk_test_...`

#### Middleware

**`DF_MIDDLEWARE_API_KEY`** (optional)
- Type: `string`
- Purpose: API key for middleware-to-middleware communication
- Example: `middleware_key_123`

**`DF_ADMIN_SECRET`** (required)
- Type: `string`
- Purpose: Secret for admin endpoints
- Example: `admin_secret_123`

**`X_DF_JOBS_SECRET`** (required)
- Type: `string`
- Purpose: Secret for job processing endpoints
- Example: `jobs_secret_123`

#### Job Processing

**`JOBS_BATCH_SIZE`** (optional)
- Type: `string`
- Purpose: Batch size for job processing
- Example: `10`

#### Texting System

**`TEXTING_SYNC_TO_ALOWARE`** (optional)
- Type: `string`
- Purpose: Enable Aloware sync for texting messages
- Example: `true`

#### Conflict Resolution

**`CONTACT_SOURCE_OF_TRUTH`** (optional)
- Type: `string` (enum: 'ghl' | 'aloware' | 'merge')
- Default: `merge`
- Purpose: Source of truth for contact conflicts
- Example: `merge`

#### Alerting

**`ALERT_WEBHOOK_URL`** (optional)
- Type: `string` (URL)
- Purpose: Webhook URL for alerts
- Example: `https://hooks.slack.com/...`

#### Agent Management

**`AGENT_LIST_KEYS`** (optional)
- Type: `string`
- Default: `CALL_NOW,NEW_LEADS,FOLLOW_UP,HOT`
- Purpose: Comma-separated list of agent list keys
- Example: `CALL_NOW,NEW_LEADS,FOLLOW_UP,HOT`

**`DEFAULT_AGENT_KEY`** (optional)
- Type: `string`
- Default: `UNASSIGNED`
- Purpose: Default agent key for unassigned contacts
- Example: `UNASSIGNED`

**`GHL_ASSIGNED_AGENT_FIELD_KEY`** (optional)
- Type: `string`
- Default: `assignedAgent`
- Purpose: GHL custom field key for assigned agent
- Example: `assignedAgent`

**`ENABLE_AGENT_LIST_SYNC`** (optional)
- Type: `string`
- Default: `true`
- Purpose: Enable agent-managed list sync
- Example: `true`

**`TAG_MATCH_MODE`** (optional)
- Type: `string` (enum: 'exact' | 'case_insensitive' | 'regex')
- Default: `case_insensitive`
- Purpose: Tag matching mode for agent resolution
- Example: `case_insensitive`

#### Aloware Sequences

**`ALOWARE_STATUS_TO_SEQUENCE`** (optional)
- Type: `string` (JSON)
- Default: `{}`
- Purpose: JSON mapping of Aloware status to sequence ID
- Example: `{"hot": "sequence_123", "warm": "sequence_456"}`

**`ENABLE_ALOWARE_SEQUENCES`** (optional)
- Type: `string`
- Default: `false`
- Purpose: Enable Aloware sequence enrollment
- Example: `false`

#### Power Dialer Lists

**`ENABLE_POWER_DIALER_LISTS`** (optional)
- Type: `string`
- Default: `false`
- Purpose: Enable power dialer list sync
- Example: `false`

#### Server

**`PORT`** (optional)
- Type: `string`
- Default: `3001`
- Purpose: Express server port
- Example: `3001`

**`BASE_URL`** (optional)
- Type: `string` (URL)
- Purpose: Base URL for the application
- Example: `https://df-middleware.example.com`

**`NODE_ENV`** (optional)
- Type: `string` (enum: 'development' | 'production' | 'test')
- Default: `development`
- Purpose: Node.js environment
- Example: `production`

**`SKIP_ENV_VALIDATION`** (optional)
- Type: `string` (boolean)
- Purpose: Skip environment variable validation
- Example: `true`

### Database Schema Reference

#### Tables

**`webhook_events`**: Stores incoming webhook events from GHL and Aloware

**`texting_webhook_events`**: Stores incoming webhook events from texting system

**`broadcast_webhook_events`**: Stores incoming webhook events from Verity

**`sync_log`**: Tracks all sync operations

**`sync_state`**: Tracks cursor position for reconciliation batches

**`contact_mappings`**: Maps contact IDs between systems

**`message_mappings`**: Maps message IDs between systems

**`optout_registry`**: Authoritative do-not-text list

**`agent_directory`**: Maps agent keys to system identifiers

**`call_list_registry`**: Tracks Aloware list IDs per agent/listKey

**`contact_list_memberships`**: Tracks contact list memberships

**`contact_agent_state`**: Tracks last known agent assignment

**`ghl_oauth_tokens`**: Stores OAuth access tokens

**`reconcile_runs`**: Tracks reconciliation job execution

**`quarantine_events`**: Stores quarantined events

### API Endpoints Reference

#### Express Server (port 3001)

**`GET /health`**: Health check endpoint

**`POST /api/verity`**: Proxy request to Verity API

**`GET /api/verity`**: Get API catalog

#### Next.js API Routes (port 3002)

**`POST /api/webhooks/ghl`**: GHL webhook handler

**`POST /api/webhooks/aloware`**: Aloware webhook handler

**`POST /api/webhooks/texting`**: Texting webhook handler

**`POST /api/webhooks/broadcast`**: Broadcast webhook handler

**`POST /api/webhooks/ghl/provider-delivery`**: GHL provider delivery webhook

**`GET /api/admin/events`**: List webhook events

**`POST /api/admin/events/{id}/mark-done`**: Mark event as done

**`POST /api/admin/events/{id}/quarantine`**: Quarantine event

**`POST /api/admin/events/{id}/replay`**: Replay event

**`POST /api/jobs/process-pending`**: Process pending jobs (cron)

**`POST /api/jobs/enqueue-pending`**: Enqueue pending webhook events

**`POST /api/sync/contacts`**: Manual contact sync

**`POST /api/sync/lists`**: Manual list sync

### File Structure Reference

**`src/index.ts`**: Express server entry point

**`src/mcp/server.ts`**: MCP server entry point

**`src/api-gateway/`**: API gateway module

**`src/lib/sync/`**: Sync library module

**`src/lib/ghl/`**: GHL integration module

**`src/lib/aloware/`**: Aloware integration module

**`src/lib/jobs/`**: Job queue module

**`src/app/api/`**: Next.js API routes

**`src/server/db/`**: Database schema and migrations

**`src/auth/`**: Authentication module

**`src/scripts/`**: Utility scripts

### Command Reference

**`bun run dev`**: Start Express server

**`bun run dev:next`**: Start Next.js dev server

**`bun run mcp`**: Start MCP server

**`bun run build`**: Build TypeScript

**`bun run lint`**: Run ESLint

**`bun run db:studio`**: Open Drizzle Studio

**`bun run db:push`**: Push database schema changes

**`bun run db:generate`**: Generate database migrations
