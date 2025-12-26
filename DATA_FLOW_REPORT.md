# Data Flow Report - DF Middleware System

**Generated:** $(date)  
**System:** DF Middleware (GHL-Aloware Integration)  
**Purpose:** Document current data flows in preparation for routing all integrations through middleware

---

## Executive Summary

The DF Middleware currently acts as a synchronization layer between **Aloware** (calling platform) and **GoHighLevel (GHL)** (CRM platform). The middleware receives webhooks from both systems and synchronizes contact, call, and list data bidirectionally.

**Current State:**
- ✅ Aloware ↔ Middleware ↔ GHL integration exists
- ⚠️ Proprietary texting system is NOT integrated with middleware
- ⚠️ Aloware and GHL are currently integrated directly with proprietary texting system (outside middleware)

**Goal:**
- Route all data flows through the middleware, including texting system integration

---

## System Architecture Overview

```
┌──────────┐         ┌──────────────┐         ┌──────┐
│ Aloware  │────────▶│  Middleware  │────────▶│ GHL  │
│ (Calls)  │◀────────│   (Sync)     │◀────────│(CRM) │
└──────────┘         └──────────────┘         └──────┘
     │                       │                     │
     │                       │                     │
     └───────────────────────┴─────────────────────┘
                             │
                    [Proprietary Texting System]
                    (Currently integrated directly,
                     NOT through middleware)
```

---

## Current Data Flows

### 1. Inbound Data Flows (Webhooks → Middleware)

#### 1.1 Aloware → Middleware

**Endpoint:** `POST /api/webhooks/aloware`  
**Authentication:** Basic Auth (username/password)  
**Location:** `src/app/api/webhooks/aloware/route.ts`

**Supported Events:**
- Contact events: `ContactCreated`, `ContactUpdated`, etc.
- Call events: `OutboundPhoneCall-*`, `InboundPhoneCall-*`
- Transcription events: Events containing "transcription"

**Event Filtering:**
- Configurable via `ALOWARE_WEBHOOK_ALLOWED_EVENTS` env variable
- Supports exact matches and pattern matching (e.g., `OutboundPhoneCall-*`)

**Processing Flow:**
1. Webhook received → Basic Auth validation
2. Event type extraction from payload
3. Event filtering (allowed events check)
4. Entity type detection (contact/call/transcription/unknown)
5. Entity ID extraction
6. Deduplication key computation (prevents duplicate processing)
7. Store in `webhook_events` table with status="pending"
8. Return 200 OK immediately (async processing)

**Data Stored:**
- Source: "aloware"
- Event type
- Entity type (contact/call/transcription)
- Entity ID
- Full payload (JSON)
- Dedupe key (for duplicate prevention)
- Status: "pending" → "processing" → "done"/"error"

**Current Limitation:**
- Events are stored but NOT automatically processed
- TODO comment indicates async processing engine needs to be implemented

---

#### 1.2 GHL → Middleware

**Endpoint:** `POST /api/webhooks/ghl`  
**Authentication:** HMAC-SHA256 signature verification (placeholder - not fully implemented)  
**Location:** `src/app/api/webhooks/ghl/route.ts`

**Supported Events:**
- Contact events: `contact.created`, `contact.updated`
- Appointment events: `appointment.created`, `appointment.updated`
- Tag/Segment events: Events containing "tag" or "segment"

**Event Detection:**
- Explicit event type from payload
- Inferred from payload structure (appointment fields, contact fields)

**Processing Flow:**
1. Webhook received → Signature verification (if secret configured)
2. Event type extraction/inference
3. Entity type detection (appointment/contact/tag/unknown)
4. Entity ID extraction
5. Deduplication key computation
6. Store in `webhook_events` table with status="pending"
7. Return 200 OK immediately (async processing)

**Data Stored:**
- Source: "ghl"
- Event type
- Entity type
- Entity ID
- Full payload (JSON)
- Dedupe key
- Status: "pending"

**Current Limitation:**
- Signature verification is placeholder (always returns true)
- Events stored but NOT automatically processed

---

### 2. Outbound Data Flows (Middleware → External Systems)

#### 2.1 Middleware → GHL (Contact Sync)

**Function:** `syncAlowareContactToGHL()`  
**Location:** `src/lib/sync/contact-sync.ts`  
**Trigger:** Manual via `/api/sync/contacts` endpoint OR (planned) webhook event processing

**Flow:**
1. Check for existing contact mapping in `contact_mappings` table
2. If mapping exists:
   - Fetch contact from Aloware API
   - Update GHL contact with Aloware data
   - Update mapping record
3. If no mapping:
   - Search for existing GHL contact by phone/email
   - If found: Update GHL contact, create mapping
   - If not found: Create new GHL contact, create mapping
4. Store Aloware contact ID → GHL contact ID mapping
5. Log sync operation in `sync_log` table

**Data Synced:**
- Basic info: email, phone, first_name, last_name
- Tags: disposition_status from Aloware
- Custom fields:
  - `alowareContactId`
  - `leadSource`
  - `intakeSource`
  - `timezone`
  - `country`
  - `state`
  - `city`

**API Calls Made:**
- `GET /contacts/{id}` (Aloware)
- `GET /contacts?query=...` (GHL - search)
- `POST /contacts` (GHL - create)
- `PUT /contacts/{id}` (GHL - update)

---

#### 2.2 Middleware → GHL (Call Sync)

**Function:** `syncAlowareCallToGHL()`  
**Location:** `src/lib/sync/call-sync.ts`  
**Trigger:** Manual OR (planned) webhook event processing

**Flow:**
1. Ensure contact is synced first (calls `syncAlowareContactToGHL`)
2. Build call note from Aloware call data:
   - Direction (inbound/outbound)
   - Date/time
   - Duration
   - Disposition
   - Status
   - Resolution
   - CSAT score
3. Append call note to GHL contact's notes field
4. Add tags to GHL contact:
   - `Call: {disposition}` (if disposition exists)
   - `Inbound Call` or `Outbound Call`
5. Log sync operation

**Data Synced:**
- Call notes appended to contact notes
- Tags added to contact

**API Calls Made:**
- Contact sync operations (see 2.1)
- `GET /contacts/{id}` (GHL - fetch existing)
- `PUT /contacts/{id}` (GHL - update notes)
- Tag operations (addTagsToContact)

---

#### 2.3 Middleware → Aloware (Call List Sync)

**Function:** `syncGHLTagToAlowareList()`  
**Location:** `src/lib/sync/list-sync.ts`  
**Trigger:** Manual via `/api/sync/lists` endpoint OR (planned) webhook event processing

**Flow:**
1. Get all contact mappings from database
2. Filter mappings to find contacts with GHL tag (currently limited - see limitations)
3. Extract Aloware contact IDs from mappings
4. Create or update Aloware call list:
   - Search for existing list by name (matches GHL tag name)
   - If exists: Update with contact IDs
   - If not: Create new list with contact IDs
5. Log sync operation

**Data Synced:**
- GHL tag name → Aloware call list name
- Contacts with tag → Call list members

**API Calls Made:**
- `GET /call-lists` (Aloware - search)
- `POST /call-lists` (Aloware - create)
- `PUT /call-lists/{id}` (Aloware - update)

**Current Limitations:**
- Does not fetch contacts from GHL API by tag
- Relies on contact mappings already existing
- More complete function exists (`syncGHLTaggedContactsToAlowareList`) but requires GHL contact IDs as input

---

### 3. Manual Sync Endpoints

#### 3.1 Contact Sync Endpoint

**Endpoint:** `POST /api/sync/contacts?alowareContactId={id}`  
**Location:** `src/app/api/sync/contacts/route.ts`

**Flow:**
1. Extract `alowareContactId` from query params
2. Fetch contact from Aloware API
3. Call `syncAlowareContactToGHL()`
4. Return success with both IDs

**Use Case:** Manual trigger for specific contact sync

---

#### 3.2 List Sync Endpoint

**Endpoint:** `POST /api/sync/lists?tagName={name}`  
**Location:** `src/app/api/sync/lists/route.ts`

**Flow:**
1. Extract `tagName` from query params
2. Call `syncGHLTagToAlowareList()`
3. Return success with call list ID

**Use Case:** Manual trigger for tag-to-list sync

---

## Database Schema

### Tables

#### 1. `webhook_events`
**Purpose:** Store incoming webhook events for async processing

**Fields:**
- `id` (UUID, PK)
- `receivedAt` (timestamp)
- `source` (text: 'ghl' | 'aloware')
- `eventType` (text)
- `entityType` (text: 'contact' | 'call' | 'list' | 'appointment' | 'tag' | 'unknown')
- `entityId` (text)
- `payloadJson` (JSONB - full webhook payload)
- `dedupeKey` (text, unique) - prevents duplicate processing
- `status` (text: 'pending' | 'processing' | 'done' | 'error')
- `errorMessage` (text, nullable)
- `processedAt` (timestamp, nullable)

**Indexes:**
- Unique on `dedupeKey`
- On `status`
- On `source, status`
- On `receivedAt`
- On `entityType, entityId`

---

#### 2. `sync_log`
**Purpose:** Track all sync operations for auditing and debugging

**Fields:**
- `id` (UUID, PK)
- `direction` (text: 'aloware_to_ghl' | 'ghl_to_aloware')
- `entityType` (text: 'contact' | 'call' | 'list')
- `entityId` (text)
- `sourceId` (text) - ID from source system
- `targetId` (text, nullable) - ID in target system
- `status` (text: 'success' | 'error')
- `startedAt` (timestamp)
- `finishedAt` (timestamp, nullable)
- `errorMessage` (text, nullable)
- `correlationId` (text, nullable) - links to webhook event

**Indexes:**
- On `entityType, entityId`
- On `direction`
- On `startedAt`
- On `correlationId`

---

#### 3. `contact_mappings`
**Purpose:** Bidirectional mapping between Aloware and GHL contact IDs

**Fields:**
- `id` (UUID, PK)
- `alowareContactId` (text, unique)
- `ghlContactId` (text, unique)
- `phoneNumber` (text, nullable) - for matching
- `email` (text, nullable) - for matching
- `lastSyncedAt` (timestamp)
- `syncDirection` (text: 'aloware_to_ghl' | 'ghl_to_aloware' | 'bidirectional')
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Indexes:**
- Unique on `alowareContactId`
- Unique on `ghlContactId`
- On `phoneNumber`
- On `email`

---

#### 4. `sync_state`
**Purpose:** Track cursor position for batch reconciliation (not currently used)

**Fields:**
- `id` (UUID, PK)
- `direction` (text)
- `entityType` (text)
- `cursorUpdatedAt` (timestamp)
- `cursorId` (text, nullable)
- `lastRunAt` (timestamp)
- `lastSuccessAt` (timestamp, nullable)

**Indexes:**
- Unique on `direction, entityType`

---

## API Clients

### Aloware API Client
**Location:** `src/lib/aloware/client.ts`  
**Base URL:** `https://app.aloware.com/api/v1`  
**Authentication:** API token in query parameter (`api_token`)

**Methods:**
- `getUsers()` - Fetch Aloware users
- `getContact(id)` - Get contact by ID
- `searchContacts(phone?, email?)` - Search contacts
- `upsertContact(contact)` - Create or update contact
- `createContact(contact)` - Create contact
- `updateContact(id, updates)` - Update contact
- `getCallLists()` - Get all call lists
- `getCallList(id)` - Get specific call list
- `createCallList(list)` - Create call list
- `updateCallList(id, updates)` - Update call list
- `addContactsToList(listId, contactIds)` - Add contacts to list
- `removeContactsFromList(listId, contactIds)` - Remove contacts from list

---

### GHL API Client
**Location:** `src/lib/ghl/client.ts`  
**Base URL:** `https://services.leadconnectorhq.com` (configurable)  
**Authentication:** Bearer token (Private Integration Token)  
**Scoping:** Location ID in query parameter

**Methods:**
- `getContact(id)` - Get contact by ID
- `searchContact(email?, phone?)` - Search contacts
- `createContact(contact)` - Create contact
- `updateContact(id, updates)` - Update contact
- `getOrCreateContact(email?, phone?, firstName?, lastName?)` - Get or create
- `addTagsToContact(id, tags)` - Add tags
- `removeTagsFromContact(id, tags)` - Remove tags

---

## Current Integration Gaps

### 1. Proprietary Texting System
**Status:** ❌ NOT INTEGRATED

**Current State:**
- Aloware is integrated directly with proprietary texting system (outside middleware)
- GHL is integrated directly with proprietary texting system (outside middleware)
- Middleware has NO integration with texting system

**Impact:**
- Texting data does not flow through middleware
- Cannot sync texting data between systems via middleware
- Texting events are not captured in middleware webhook events

**Required for Full Middleware Routing:**
- Webhook endpoint to receive texting events
- API client to send messages via texting system
- Sync logic to route texting data between Aloware/GHL and texting system
- Database schema updates to track texting events and messages

---

### 2. Async Event Processing
**Status:** ⚠️ INCOMPLETE

**Current State:**
- Webhooks are received and stored in `webhook_events` table
- Events remain in "pending" status
- No automatic processing of webhook events

**Impact:**
- Webhooks are stored but not acted upon automatically
- Manual sync endpoints must be called to trigger syncs
- Real-time sync is not functional

**Required:**
- Background job processor (queue system)
- Event processor that reads `webhook_events` table
- Routes events to appropriate sync functions
- Updates event status to "processing" → "done"/"error"

---

### 3. GHL → Aloware Contact Sync
**Status:** ⚠️ NOT IMPLEMENTED

**Current State:**
- Only Aloware → GHL contact sync exists
- GHL webhooks are received but not processed
- No function to sync GHL contact changes back to Aloware

**Impact:**
- Changes made in GHL are not reflected in Aloware
- One-way sync only (Aloware → GHL)

**Required:**
- Function: `syncGHLContactToAloware()`
- Process GHL contact webhook events
- Update Aloware contacts when GHL contacts change

---

### 4. Call List Sync Completeness
**Status:** ⚠️ PARTIAL

**Current State:**
- Basic list sync exists but doesn't fetch contacts from GHL by tag
- Relies on existing contact mappings
- More complete function exists but requires manual GHL contact ID input

**Impact:**
- Tag-to-list sync may miss contacts
- Requires manual intervention for complete sync

**Required:**
- GHL API method to fetch contacts by tag
- Automatic fetching of tagged contacts from GHL
- Complete list sync without manual input

---

## Data Flow Diagrams

### Current Flow: Aloware Contact Created

```
1. Contact created in Aloware
   ↓
2. Aloware sends webhook → POST /api/webhooks/aloware
   ↓
3. Middleware validates auth, stores event in webhook_events (status: pending)
   ↓
4. [MANUAL] Call POST /api/sync/contacts?alowareContactId={id}
   ↓
5. Middleware fetches contact from Aloware API
   ↓
6. Middleware searches/creates contact in GHL
   ↓
7. Middleware stores mapping in contact_mappings
   ↓
8. Middleware logs sync in sync_log
   ↓
9. Contact now exists in both systems
```

---

### Current Flow: Aloware Call Completed

```
1. Call completed in Aloware
   ↓
2. Aloware sends webhook → POST /api/webhooks/aloware
   ↓
3. Middleware validates auth, stores event in webhook_events (status: pending)
   ↓
4. [MANUAL] Process webhook event (not yet automated)
   ↓
5. Middleware calls syncAlowareCallToGHL()
   ↓
6. Middleware ensures contact is synced
   ↓
7. Middleware appends call note to GHL contact
   ↓
8. Middleware adds call tags to GHL contact
   ↓
9. Middleware logs sync in sync_log
```

---

### Current Flow: GHL Tag Added to Contact

```
1. Tag added to contact in GHL
   ↓
2. GHL sends webhook → POST /api/webhooks/ghl
   ↓
3. Middleware validates signature, stores event in webhook_events (status: pending)
   ↓
4. [MANUAL] Call POST /api/sync/lists?tagName={name}
   ↓
5. Middleware gets contact mappings from database
   ↓
6. Middleware filters to contacts with tag (limited - see gaps)
   ↓
7. Middleware creates/updates Aloware call list
   ↓
8. Middleware logs sync in sync_log
```

---

## Environment Configuration

**Required Environment Variables:**

```bash
# Database
DATABASE_URL=postgresql://...

# GHL
GHL_API_KEY=...              # Private Integration Token
GHL_LOCATION_ID=...
GHL_CALENDAR_ID=...
GHL_BASE_URL=...             # Optional, defaults to leadconnectorhq.com
GHL_WEBHOOK_SECRET=...       # Optional, for signature verification

# Aloware
ALOWARE_API_TOKEN=...
ALOWARE_WEBHOOK_BASIC_USER=...
ALOWARE_WEBHOOK_BASIC_PASS=...
ALOWARE_WEBHOOK_ALLOWED_EVENTS=...  # Optional, comma-separated

# Application
BASE_URL=...                 # Optional, for webhook URLs
NODE_ENV=development|production|test
```

---

## Recommendations for Full Middleware Routing

### Priority 1: Implement Async Event Processing
- Set up background job queue (e.g., BullMQ, pg-boss, or similar)
- Create event processor that reads `webhook_events` table
- Route events to appropriate sync functions
- Update event status and handle errors

### Priority 2: Integrate Proprietary Texting System
- Create webhook endpoint: `POST /api/webhooks/texting`
- Create API client for texting system
- Implement sync functions:
  - `syncTextingMessageToGHL()`
  - `syncTextingMessageToAloware()`
  - `syncGHLMessageToTexting()`
  - `syncAlowareMessageToTexting()`
- Add database tables for texting events and message mappings

### Priority 3: Implement Bidirectional Contact Sync
- Create `syncGHLContactToAloware()` function
- Process GHL contact webhook events
- Handle conflict resolution (which system wins?)

### Priority 4: Complete Call List Sync
- Add GHL API method to fetch contacts by tag
- Update `syncGHLTagToAlowareList()` to fetch from GHL API
- Ensure all tagged contacts are included in sync

### Priority 5: Add Monitoring & Observability
- Add metrics/analytics for sync operations
- Add alerting for failed syncs
- Add dashboard for sync status

---

## Summary

**Current Capabilities:**
- ✅ Receives webhooks from Aloware and GHL
- ✅ Stores webhook events in database
- ✅ Manual sync endpoints for contacts and lists
- ✅ Contact sync: Aloware → GHL
- ✅ Call sync: Aloware → GHL
- ✅ List sync: GHL → Aloware (partial)

**Missing Capabilities:**
- ❌ Automatic webhook event processing
- ❌ Proprietary texting system integration
- ❌ Bidirectional contact sync (GHL → Aloware)
- ❌ Complete call list sync
- ❌ Texting data sync

**Next Steps:**
1. Implement async event processing engine
2. Integrate proprietary texting system
3. Complete bidirectional sync capabilities
4. Add monitoring and error handling

---

**Report End**

