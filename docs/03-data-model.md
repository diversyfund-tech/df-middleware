# Data Model

## Executive Summary

DF-Middleware uses PostgreSQL with Drizzle ORM. The schema focuses on webhook event processing, sync state tracking, contact/message mappings, and agent management. All tables use UUID primary keys and timestamps for audit trails.

**Key Tables:**
- `webhook_events` - Incoming webhook events (GHL, Aloware)
- `texting_webhook_events` - Texting system webhook events
- `broadcast_webhook_events` - Broadcast analytics events
- `sync_log` - Sync operation audit trail
- `contact_mappings` - Bidirectional contact ID mappings
- `message_mappings` - Message ID mappings across systems
- `optout_registry` - Authoritative do-not-text list
- `agent_directory` - Agent key to system identifier mappings
- `call_list_registry` - Aloware list IDs per agent/listKey

## Engineering Details

### Schema Location

**File**: `src/server/db/schema.ts`

**ORM**: Drizzle ORM (`drizzle-orm`)

**Database**: PostgreSQL

### Core Tables

#### webhook_events

Stores incoming webhook events from GHL and Aloware for async processing.

**Columns**:
- `id` (uuid, PK) - Primary key
- `received_at` (timestamp) - When event was received
- `source` (text) - 'ghl' | 'aloware'
- `event_type` (text) - Event type identifier
- `entity_type` (text) - 'contact' | 'call' | 'list' | etc.
- `entity_id` (text) - Entity identifier from source system
- `payload_json` (jsonb) - Full webhook payload
- `dedupe_key` (text, unique) - Deduplication key (source + eventType + entityId)
- `status` (text) - 'pending' | 'processing' | 'done' | 'error'
- `error_message` (text, nullable) - Error message if status is 'error'
- `processed_at` (timestamp, nullable) - When event was processed

**Indexes**:
- `dedupe_key_unique` - Unique index on dedupe_key
- `status_idx` - Index on status
- `source_status_idx` - Composite index on (source, status)
- `received_at_idx` - Index on received_at
- `entity_idx` - Composite index on (entity_type, entity_id)

**File**: `src/server/db/schema.ts:16-38`

#### texting_webhook_events

Stores incoming webhook events from texting system.

**Columns**:
- `id` (uuid, PK) - Primary key
- `received_at` (timestamp) - When event was received
- `event_type` (text) - Event type identifier
- `entity_type` (text, default: 'message') - Entity type
- `entity_id` (text, nullable) - Entity identifier
- `conversation_id` (text, nullable) - Conversation identifier
- `from_number` (text, nullable) - Sender phone number
- `to_number` (text, nullable) - Recipient phone number
- `payload_json` (jsonb) - Full webhook payload
- `dedupe_key` (text, unique) - Deduplication key
- `status` (text) - 'pending' | 'processing' | 'done' | 'error'
- `error_message` (text, nullable) - Error message
- `processed_at` (timestamp, nullable) - When processed

**Indexes**:
- `dedupe_key_unique` - Unique index on dedupe_key
- `status_idx` - Index on status
- `received_at_idx` - Index on received_at
- `entity_id_idx` - Index on entity_id
- `conversation_id_idx` - Index on conversation_id
- `from_number_idx` - Index on from_number

**File**: `src/server/db/schema.ts:121-146`

#### broadcast_webhook_events

Stores incoming webhook events from Verity for broadcast analytics sync.

**Columns**:
- `id` (uuid, PK) - Primary key
- `received_at` (timestamp) - When event was received
- `broadcast_id` (text) - Broadcast identifier
- `event_type` (text) - 'analytics_updated' | 'broadcast_completed'
- `payload_json` (jsonb) - Full webhook payload
- `dedupe_key` (text, unique) - Deduplication key
- `status` (text) - 'pending' | 'processing' | 'done' | 'error'
- `error_message` (text, nullable) - Error message
- `processed_at` (timestamp, nullable) - When processed

**Indexes**:
- `dedupe_key_unique` - Unique index on dedupe_key
- `status_idx` - Index on status
- `broadcast_id_idx` - Index on broadcast_id
- `received_at_idx` - Index on received_at

**File**: `src/server/db/schema.ts:152-171`

#### sync_log

Tracks all sync operations between GHL and Aloware for audit and debugging.

**Columns**:
- `id` (uuid, PK) - Primary key
- `direction` (text) - 'aloware_to_ghl' | 'ghl_to_aloware'
- `entity_type` (text) - 'contact' | 'call' | 'list'
- `entity_id` (text) - Entity identifier
- `source_id` (text) - ID from source system
- `target_id` (text, nullable) - ID in target system (if created/updated)
- `status` (text) - 'success' | 'error'
- `started_at` (timestamp) - When sync started
- `finished_at` (timestamp, nullable) - When sync finished
- `error_message` (text, nullable) - Error message if status is 'error'
- `correlation_id` (text, nullable) - Links to webhook event or batch run

**Indexes**:
- `entity_idx` - Composite index on (entity_type, entity_id)
- `direction_idx` - Index on direction
- `started_at_idx` - Index on started_at
- `correlation_idx` - Index on correlation_id

**File**: `src/server/db/schema.ts:44-65`

#### sync_state

Tracks cursor position for reconciliation batches.

**Columns**:
- `id` (uuid, PK) - Primary key
- `direction` (text) - 'aloware_to_ghl' | 'ghl_to_aloware'
- `entity_type` (text) - 'contact' | 'call' | 'list'
- `cursor_updated_at` (timestamp) - When cursor was updated
- `cursor_id` (text, nullable) - Last processed ID or timestamp
- `last_run_at` (timestamp) - When batch last ran
- `last_success_at` (timestamp, nullable) - When batch last succeeded

**Indexes**:
- `direction_entity_unique` - Unique composite index on (direction, entity_type)

**File**: `src/server/db/schema.ts:71-84`

#### contact_mappings

Maps Aloware contact IDs to GHL contact IDs for bidirectional sync.

**Columns**:
- `id` (uuid, PK) - Primary key
- `aloware_contact_id` (text, nullable) - Aloware contact ID (nullable for texting-only contacts)
- `ghl_contact_id` (text) - GHL contact ID
- `phone_number` (text, nullable) - Match key for deduplication (E.164 format)
- `email` (text, nullable) - Match key for deduplication
- `last_synced_at` (timestamp) - When contact was last synced
- `sync_direction` (text) - 'aloware_to_ghl' | 'ghl_to_aloware' | 'bidirectional'
- `created_at` (timestamp) - When mapping was created
- `updated_at` (timestamp) - When mapping was updated

**Indexes**:
- `aloware_contact_id_unique` - Unique index on aloware_contact_id
- `ghl_contact_id_unique` - Unique index on ghl_contact_id
- `phone_idx` - Index on phone_number
- `email_idx` - Index on email

**File**: `src/server/db/schema.ts:90-115`

#### message_mappings

Maps messages across texting system, GHL, and Aloware.

**Columns**:
- `id` (uuid, PK) - Primary key
- `texting_message_id` (text, nullable) - Texting system message ID
- `ghl_message_id` (text, nullable) - GHL message ID
- `aloware_message_id` (text, nullable) - Aloware message ID
- `conversation_id` (text, nullable) - Conversation identifier
- `ghl_contact_id` (text, nullable) - GHL contact ID
- `aloware_contact_id` (text, nullable) - Aloware contact ID
- `from_number` (text, nullable) - Sender phone number
- `to_number` (text, nullable) - Recipient phone number
- `direction` (text, nullable) - 'inbound' | 'outbound'
- `created_at` (timestamp) - When mapping was created
- `updated_at` (timestamp) - When mapping was updated

**Indexes**:
- `texting_message_id_unique` - Unique index on texting_message_id
- `ghl_message_id_unique` - Unique index on ghl_message_id
- `aloware_message_id_unique` - Unique index on aloware_message_id
- `conversation_id_idx` - Index on conversation_id
- `ghl_contact_id_idx` - Index on ghl_contact_id
- `aloware_contact_id_idx` - Index on aloware_contact_id
- `from_number_idx` - Index on from_number
- `to_number_idx` - Index on to_number

**File**: `src/server/db/schema.ts:177-207`

#### optout_registry

Authoritative do-not-text list with audit trail.

**Columns**:
- `id` (uuid, PK) - Primary key
- `phone_number` (text, unique) - Phone number in E.164 format
- `status` (text) - 'opted_out' | 'opted_in'
- `source` (text) - 'texting' | 'ghl' | 'manual'
- `reason` (text, nullable) - 'STOP' | 'HELP' | 'other'
- `last_event_at` (timestamp) - When last opt-out/in event occurred
- `created_at` (timestamp) - When record was created
- `updated_at` (timestamp) - When record was updated

**Indexes**:
- `phone_number_unique` - Unique index on phone_number
- `status_idx` - Index on status

**File**: `src/server/db/schema.ts:213-229`

#### agent_directory

Maps agent keys to GHL identifiers for agent resolution.

**Columns**:
- `id` (uuid, PK) - Primary key
- `agent_key` (text, unique) - Agent key ('CHRIS' | 'RAFI' | 'UNASSIGNED')
- `display_name` (text) - Display name
- `ghl_owner_id` (text, nullable) - GHL owner ID
- `ghl_owner_email` (text, nullable) - GHL owner email
- `ghl_assigned_agent_field_value` (text, nullable) - Custom field value (e.g., "Chris", "Rafi")
- `required_tag` (text, nullable) - Tag pattern (e.g., "Owner: Chris")
- `aloware_user_id` (text, nullable) - Aloware user ID
- `is_active` (boolean, default: true) - Whether agent is active
- `created_at` (timestamp) - When record was created
- `updated_at` (timestamp) - When record was updated

**Indexes**:
- `agent_key_unique` - Unique index on agent_key
- `is_active_idx` - Index on is_active

**File**: `src/server/db/schema.ts:272-291`

#### call_list_registry

Tracks Aloware list IDs per agent/listKey combination.

**Columns**:
- `id` (uuid, PK) - Primary key
- `agent_key` (text) - Agent key
- `list_key` (text) - List key ('CALL_NOW' | 'NEW_LEADS' | 'FOLLOW_UP' | 'HOT')
- `aloware_list_id` (text, nullable) - Aloware list ID
- `aloware_list_name` (text) - List name (e.g., 'DF_CHRIS_CALL_NOW')
- `created_at` (timestamp) - When record was created
- `updated_at` (timestamp) - When record was updated

**Indexes**:
- `agent_list_unique` - Unique composite index on (agent_key, list_key)
- `aloware_list_name_unique` - Unique index on aloware_list_name
- `agent_key_idx` - Index on agent_key
- `list_key_idx` - Index on list_key

**File**: `src/server/db/schema.ts:297-319`

#### contact_list_memberships

Tracks which contacts belong to which lists.

**Columns**:
- `id` (uuid, PK) - Primary key
- `contact_id` (text) - GHL contact ID
- `agent_key` (text) - Agent key
- `list_key` (text) - List key
- `status` (text) - 'active' | 'removed'
- `reason` (text, nullable) - Optional reason for status change
- `created_at` (timestamp) - When membership was created
- `updated_at` (timestamp) - When membership was updated

**Indexes**:
- `contact_agent_list_unique` - Unique composite index on (contact_id, agent_key, list_key)
- `contact_id_idx` - Index on contact_id
- `agent_list_idx` - Composite index on (agent_key, list_key)
- `status_idx` - Index on status

**File**: `src/server/db/schema.ts:325-350`

#### contact_agent_state

Tracks last known agent assignment for reassignment detection.

**Columns**:
- `id` (uuid, PK) - Primary key
- `contact_id` (text, unique) - GHL contact ID
- `agent_key` (text) - Last known agent key
- `last_aloware_list_status` (text, nullable) - Last known aloware_list_status value (for idempotency)
- `created_at` (timestamp) - When record was created
- `updated_at` (timestamp) - When record was updated

**Indexes**:
- `contact_id_unique` - Unique index on contact_id
- `agent_key_idx` - Index on agent_key

**File**: `src/server/db/schema.ts:356-370`

#### ghl_oauth_tokens

Stores OAuth access tokens for Marketplace App installations.

**Columns**:
- `id` (uuid, PK) - Primary key
- `location_id` (text, unique) - GHL location ID
- `access_token` (text) - OAuth access token
- `refresh_token` (text, nullable) - OAuth refresh token
- `token_type` (text, default: 'Bearer') - Token type
- `scope` (text, nullable) - OAuth scope
- `expires_at` (timestamp) - When token expires
- `created_at` (timestamp) - When record was created
- `updated_at` (timestamp) - When record was updated

**Indexes**:
- `location_id_unique` - Unique index on location_id
- `expires_at_idx` - Index on expires_at

**File**: `src/server/db/schema.ts:377-394`

#### reconcile_runs

Tracks reconciliation job execution.

**Columns**:
- `id` (uuid, PK) - Primary key
- `job_name` (text) - Job name identifier
- `started_at` (timestamp) - When job started
- `finished_at` (timestamp, nullable) - When job finished
- `status` (text) - 'running' | 'success' | 'error'
- `totals` (jsonb, nullable) - JSON object with counts
- `error_message` (text, nullable) - Error message if status is 'error'

**Indexes**:
- `job_name_idx` - Index on job_name
- `started_at_idx` - Index on started_at

**File**: `src/server/db/schema.ts:235-246`

#### quarantine_events

Stores quarantined events that should be excluded from processing.

**Columns**:
- `id` (uuid, PK) - Primary key
- `event_id` (text) - Event identifier
- `event_source` (text) - 'webhook' | 'texting'
- `reason` (text) - Reason for quarantine
- `quarantined_at` (timestamp) - When event was quarantined
- `quarantined_by` (text, nullable) - Optional admin identifier

**Indexes**:
- `event_id_idx` - Index on event_id
- `event_source_idx` - Index on event_source

**File**: `src/server/db/schema.ts:252-266`

### Data Relationships

#### Contact Mapping Flow

```
GHL Contact Created/Updated
    │
    ▼
webhook_events (source: 'ghl', entity_type: 'contact')
    │
    ▼
Job Worker Processes Event
    │
    ├─► Check contact_mappings (by phone_number or email)
    │
    ├─► If exists: Update Aloware contact
    │
    ├─► If not exists: Create in Aloware, Create contact_mappings entry
    │
    ▼
sync_log (direction: 'ghl_to_aloware', status: 'success')
```

#### Message Mapping Flow

```
Texting Message Received
    │
    ▼
texting_webhook_events (entity_type: 'message')
    │
    ▼
Job Worker Processes Event
    │
    ├─► Find contact_mappings (by phone_number)
    │
    ├─► Create message in GHL (if contact exists)
    │
    ├─► Create message in Aloware (if contact exists)
    │
    ▼
message_mappings (links all message IDs)
```

#### Agent List Flow

```
Contact Assigned to Agent
    │
    ▼
GHL Webhook (contact updated)
    │
    ▼
Resolve Agent (agent_directory lookup)
    │
    ▼
Resolve List Intent (call_list_registry lookup)
    │
    ▼
Update contact_list_memberships
    │
    ▼
Sync to Aloware List
```

### Deduplication Strategy

All webhook events use `dedupe_key` for deduplication:

- **webhook_events**: `source + eventType + entityId`
- **texting_webhook_events**: `eventType + conversationId + entityId` (or similar)
- **broadcast_webhook_events**: `broadcastId + eventType + timestamp`

Unique indexes on `dedupe_key` prevent duplicate processing.

### Sync State Management

`sync_state` table tracks cursor position for batch reconciliation:

- `cursor_id` - Last processed ID or timestamp
- `last_run_at` - When batch last ran
- `last_success_at` - When batch last succeeded

Used by reconciliation jobs to resume from last position.

### Migration Files

**Location**: `src/server/db/migrations/`

**Files**:
- `0000_tearful_nightshade.sql` - Initial schema
- `0001_secret_vision.sql` - Migration 1
- `0002_sparkling_centennial.sql` - Migration 2
- `0003_gorgeous_northstar.sql` - Migration 3
- `0004_add_broadcast_webhook_events.sql` - Broadcast events table

**Metadata**: `meta/_journal.json`, `meta/*_snapshot.json`

### Database Connection

**File**: `src/server/db/index.ts`

**ORM**: Drizzle ORM

**Connection**: `DATABASE_URL` environment variable

### Known Schema Limitations

1. **No Foreign Keys**: Tables use text IDs instead of foreign keys (for external system IDs)
2. **No Cascading Deletes**: Manual cleanup required
3. **JSONB Payloads**: Full webhook payloads stored (may grow large over time)
4. **No Partitioning**: Webhook events tables may need partitioning for high volume
