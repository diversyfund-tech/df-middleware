# DF Middleware - GHL-Aloware Integration

A middleware service that synchronizes data bidirectionally between GoHighLevel (GHL) and Aloware, with primary focus on Aloware → GHL sync for contacts, calls, and communications, and GHL → Aloware sync for call list management.

## Features

- **Contact Sync (Aloware → GHL)**: Automatically syncs Aloware contacts to GHL contacts
- **Call Sync (Aloware → GHL)**: Syncs call data and updates GHL contacts with call notes and tags
- **Call List Sync (GHL → Aloware)**: Syncs GHL tags/segments to Aloware call lists
- **Webhook Handlers**: Receives and processes webhooks from both GHL and Aloware
- **Database Tracking**: Maintains sync state, logs, and contact mappings

## Architecture

```
Aloware → Webhooks → Middleware → GHL
GHL → Webhooks → Middleware → Aloware (Call Lists)
```

## Setup

### Prerequisites

- Node.js 20.x
- PostgreSQL database
- GHL API credentials (Private Integration Token, Location ID, Calendar ID)
- Aloware API credentials (API Token, Webhook Basic Auth)

### Installation

1. Clone the repository:
```bash
cd /Users/jaredlutz/Github/df-middleware
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
# Copy .env.local and fill in your credentials
cp .env.local.example .env.local
```

4. Set up the database:
```bash
# Generate migrations
pnpm run db:generate

# Push schema to database
pnpm run db:push
```

### Environment Variables

Required environment variables (see `.env.local`):

- `DATABASE_URL` - PostgreSQL connection string
- `GHL_API_KEY` - GHL Private Integration Token
- `GHL_LOCATION_ID` - GHL Location ID
- `GHL_CALENDAR_ID` - GHL Calendar ID
- `GHL_BASE_URL` - GHL API base URL (default: https://services.leadconnectorhq.com)
- `ALOWARE_API_TOKEN` - Aloware API token
- `ALOWARE_WEBHOOK_BASIC_USER` - Basic auth username for webhooks
- `ALOWARE_WEBHOOK_BASIC_PASS` - Basic auth password for webhooks
- `ALOWARE_WEBHOOK_ALLOWED_EVENTS` - Comma-separated list of allowed events
- `BASE_URL` - Base URL for webhook endpoints
- `X_DF_JOBS_SECRET` - Secret key for job processing endpoints (required)
- `JOBS_BATCH_SIZE` - Number of events to process per batch (optional, default: 100)
- `TEXTING_WEBHOOK_SECRET` - Secret key for texting webhook authentication (required)
- `TEXTING_BASE_URL` - Base URL for texting system API (required)
- `TEXTING_API_KEY` - API key for texting system (required)
- `TEXTING_FROM_NUMBER` - Default phone number for outbound messages (optional)
- `TEXTING_LOCATION_ID` - Location ID for texting system (optional)
- `TEXTING_SYNC_TO_ALOWARE` - Enable syncing texting messages to Aloware (optional, default: false)
- `DF_ADMIN_SECRET` - Secret key for admin endpoints (required)
- `CONTACT_SOURCE_OF_TRUTH` - Source of truth for contact sync: 'ghl', 'aloware', or 'merge' (optional, default: 'merge')
- `ALERT_WEBHOOK_URL` - Webhook URL for alerts (optional)

## Usage

### Development

```bash
pnpm run dev
```

### Webhook Endpoints

- `POST /api/webhooks/aloware` - Aloware webhook handler
- `POST /api/webhooks/ghl` - GHL webhook handler
- `POST /api/webhooks/texting` - Texting system webhook handler
- `GET /api/health` - Health check endpoint

### Manual Sync Endpoints

- `POST /api/sync/contacts?alowareContactId=xxx` - Manually sync a contact from Aloware to GHL
- `POST /api/sync/lists?tagName=xxx` - Manually sync a GHL tag to Aloware call list

### Running the Worker

The middleware uses an async event processing system powered by pg-boss. Webhook events are stored with `status='pending'` and processed by a background worker.

**Start the worker:**
```bash
pnpm run worker
```

The worker will:
- Process webhook events from the `webhook_events` table
- Route events to appropriate sync handlers
- Update event status to `done` or `error`
- Handle retries automatically (up to 10 retries with exponential backoff)

**Enqueue pending events:**
```bash
curl -X POST http://localhost:3000/api/jobs/enqueue-pending \
  -H "X-DF-JOBS-SECRET: your-secret-key"
```

This will enqueue up to 100 pending events (or `JOBS_BATCH_SIZE` if configured) for processing.

**Process events immediately (for testing):**
```bash
curl -X POST http://localhost:3000/api/jobs/run-once \
  -H "X-DF-JOBS-SECRET: your-secret-key"
```

This processes events sequentially without requiring the worker process (useful for development/testing).

**Enqueue pending texting events:**
```bash
curl -X POST http://localhost:3000/api/jobs/enqueue-texting-pending \
  -H "X-DF-JOBS-SECRET: your-secret-key"
```

### Texting Integration

The middleware integrates with your proprietary texting system to sync messages to GHL (and optionally Aloware).

**Texting Webhook Examples:**

Inbound SMS:
```bash
curl -X POST "$BASE_URL/api/webhooks/texting" \
  -H "Content-Type: application/json" \
  -H "X-Texting-Secret: $TEXTING_WEBHOOK_SECRET" \
  -d '{
    "type":"message.received",
    "message":{
      "id":"msg_123",
      "conversationId":"conv_abc",
      "from":"+16195550111",
      "to":"+18885550123",
      "body":"Hey, I have a question about my investment",
      "timestamp":"2025-12-26T14:00:00Z"
    }
  }'
```

STOP opt-out:
```bash
curl -X POST "$BASE_URL/api/webhooks/texting" \
  -H "Content-Type: application/json" \
  -H "X-Texting-Secret: $TEXTING_WEBHOOK_SECRET" \
  -d '{
    "type":"message.received",
    "message":{
      "id":"msg_124",
      "conversationId":"conv_abc",
      "from":"+16195550111",
      "to":"+18885550123",
      "body":"STOP",
      "timestamp":"2025-12-26T14:01:00Z"
    }
  }'
```

**Texting Sync Flow:**
1. Texting system sends webhook → `POST /api/webhooks/texting`
2. Webhook handler stores event in `texting_webhook_events` table
3. Worker processes event:
   - For messages: Syncs to GHL (appends as contact note)
   - For STOP: Updates opt-out registry and tags GHL contact
   - Optionally syncs to Aloware if `TEXTING_SYNC_TO_ALOWARE=true`

### Admin API Endpoints

All admin endpoints require `X-DF-ADMIN-SECRET` header.

**List Events:**
```bash
GET /api/admin/events?source=aloware&status=pending&limit=50
```

**Replay Event:**
```bash
POST /api/admin/events/:id/replay
```

**Quarantine Event:**
```bash
POST /api/admin/events/:id/quarantine
Body: { "reason": "Manual quarantine", "eventSource": "webhook" }
```

**Mark Event Done:**
```bash
POST /api/admin/events/:id/mark-done
```

**Repair Contact Mapping:**
```bash
POST /api/admin/mappings/repair?phone=+1234567890&email=test@example.com
```

**Texting Events (Debug):**
```bash
GET /api/admin/texting/events?status=pending&limit=50&includeBody=true
```

### Conflict Resolution

The middleware supports configurable conflict resolution for contacts:

- **Source of Truth**: Set `CONTACT_SOURCE_OF_TRUTH` to:
  - `ghl` - GHL is source of truth, push to Aloware
  - `aloware` - Aloware is source of truth, push to GHL
  - `merge` - Merge both contacts using field-level rules (default)

**Merge Rules:**
- Phone: Never overwrite once set unless new is E.164-valid and old is not
- Email: Prefer non-empty; if both differ → keep GHL, record conflict
- Name: Prefer longer non-empty string
- Timezone: Prefer GHL
- Address: Prefer GHL unless missing
- Tags: Union + de-dupe; preserve `SYS:` prefixed tags

### Loop Prevention

The middleware detects and prevents infinite sync loops by checking for origin markers:
- GHL: Tags containing `SYS:df_middleware_origin`, custom field `SYS:origin_id:<uuid>`
- Aloware: Notes/custom fields with middleware markers

Middleware-originated updates are automatically skipped to prevent loops.

### Reconciliation

Reconciliation jobs ensure data consistency between systems. Run manually or schedule:

```typescript
import { reconcileContacts } from "@/lib/reconcile/contacts";
await reconcileContacts();
```

The reconciliation job:
- Iterates through all contact mappings
- Verifies contacts exist in both systems
- Syncs contacts to ensure consistency
- Logs drift count, repairs count, and errors

## Database Schema

The middleware uses the following tables:

- `webhook_events` - Stores incoming webhook events from Aloware/GHL
- `texting_webhook_events` - Stores incoming webhook events from texting system
- `sync_log` - Tracks all sync operations
- `sync_state` - Tracks cursor position for reconciliation batches
- `contact_mappings` - Maps Aloware contact IDs to GHL contact IDs
- `message_mappings` - Maps messages across texting system, GHL, and Aloware
- `optout_registry` - Authoritative do-not-text list with audit trail
- `reconcile_runs` - Tracks reconciliation job execution
- `quarantine_events` - Stores quarantined events excluded from processing

## Sync Flow

### Aloware → GHL (Primary)

1. Aloware sends webhook when contact is created/updated or call is completed
2. Webhook handler stores event in `webhook_events` table
3. Sync engine processes event:
   - For contacts: Creates/updates GHL contact and stores mapping
   - For calls: Updates GHL contact with call notes and tags

### GHL → Aloware (Call Lists)

1. GHL sends webhook when tag/segment changes
2. Webhook handler stores event
3. Sync engine creates/updates Aloware call list with contacts that have the tag

## Project Structure

```
df-middleware/
├── src/
│   ├── lib/
│   │   ├── ghl/          # GHL API client
│   │   ├── aloware/      # Aloware API client
│   │   └── sync/         # Sync logic
│   ├── server/
│   │   └── db/           # Database schema and connection
│   └── app/
│       └── api/          # API routes (webhooks, sync endpoints)
├── .env.local            # Environment variables
├── drizzle.config.ts     # Drizzle ORM configuration
└── package.json
```

## License

Private
