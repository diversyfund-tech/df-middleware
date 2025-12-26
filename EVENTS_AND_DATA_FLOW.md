# Events, Source of Truth, and Data Flow Documentation

**Last Updated:** December 26, 2024  
**System:** DF Middleware - GHL, Aloware, and Texting Integration

---

## Table of Contents

1. [Event Sources Overview](#event-sources-overview)
2. [All Supported Events](#all-supported-events)
3. [Source of Truth Configuration](#source-of-truth-configuration)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Event Routing Logic](#event-routing-logic)
6. [Data Movement Patterns](#data-movement-patterns)

---

## Event Sources Overview

The middleware receives webhook events from three systems:

1. **Aloware** (Calling Platform) → `POST /api/webhooks/aloware`
2. **GoHighLevel (GHL)** (CRM Platform) → `POST /api/webhooks/ghl`
3. **Proprietary Texting System** → `POST /api/webhooks/texting`

All events are:
- Stored in database with `status='pending'`
- Processed asynchronously by worker process
- Routed to appropriate sync handlers
- Logged in `sync_log` table for audit

---

## All Supported Events

### 1. Aloware Events

**Webhook Endpoint:** `POST /api/webhooks/aloware`  
**Authentication:** Basic Auth (username/password)  
**Event Filtering:** Configurable via `ALOWARE_WEBHOOK_ALLOWED_EVENTS` env var

#### Supported Event Types:

| Event Pattern | Entity Type | Action | Destination |
|--------------|-------------|--------|-------------|
| `*Contact*` (e.g., `ContactCreated`, `ContactUpdated`) | `contact` | Sync contact to GHL | GHL |
| `*PhoneCall*` or `*Call*` (e.g., `OutboundPhoneCall-Completed`, `InboundPhoneCall-Completed`) | `call` | Sync call data to GHL contact | GHL |
| `*transcription*` | `transcription` | Marked as "not-implemented" | None (logged only) |

**Event Detection Logic:**
- Checks if event name contains "Contact" → `entityType='contact'`
- Checks if event name contains "PhoneCall" or "Call" → `entityType='call'`
- Checks if event name contains "transcription" → `entityType='transcription'`

**Examples:**
- `ContactCreated` → Contact sync to GHL
- `ContactUpdated` → Contact sync to GHL
- `OutboundPhoneCall-Completed` → Call sync to GHL
- `InboundPhoneCall-Completed` → Call sync to GHL

---

### 2. GHL (GoHighLevel) Events

**Webhook Endpoint:** `POST /api/webhooks/ghl`  
**Authentication:** HMAC-SHA256 signature (placeholder - not fully implemented)  
**Event Detection:** Explicit event type or inferred from payload structure

#### Supported Event Types:

| Event Type | Entity Type | Action | Destination |
|-----------|-------------|--------|-------------|
| `contact.created` | `contact` | Sync contact to Aloware | Aloware |
| `contact.updated` | `contact` | Sync contact to Aloware | Aloware |
| `*tag*` (any event containing "tag") | `tag` | Sync tag to Aloware call list | Aloware |
| `*segment*` (any event containing "segment") | `tag` | Sync segment to Aloware call list | Aloware |
| `appointment.created` | `appointment` | Not processed (no handler) | None |

**Event Detection Logic:**
- Explicit `event` field in payload
- Inferred from payload structure:
  - Has appointment fields (`startTime`, `endTime`, `calendarId`) → `appointment.created`
  - Has contact fields (`contactId`, `firstName`, `email`) → `contact.updated`

**Examples:**
- `contact.created` → Contact sync to Aloware
- `contact.updated` → Contact sync to Aloware
- `tag.added` → Tag sync to Aloware call list
- `contact.tagged` → Tag sync to Aloware call list

---

### 3. Texting System Events

**Webhook Endpoint:** `POST /api/webhooks/texting`  
**Authentication:** `X-Texting-Secret` header  
**Event Normalization:** Generic normalizer handles various provider formats

#### Supported Event Types:

| Event Type | Entity Type | Action | Destinations |
|-----------|-------------|--------|--------------|
| `message.received` | `message` | Sync message to GHL (and optionally Aloware) | GHL, Aloware* |
| `message.sent` | `message` | Sync message to GHL (and optionally Aloware) | GHL, Aloware* |
| `message.delivered` | `message` | Not processed (status update only) | None |
| `message.failed` | `message` | Not processed (error logged) | None |
| `optout.stop` | `optout` | Update opt-out registry, tag GHL contact | GHL (opt-out registry) |
| `optout.help` | `optout` | Not processed (future enhancement) | None |
| `conversation.created` | `conversation` | Not processed (future enhancement) | None |

*Aloware sync only if `TEXTING_SYNC_TO_ALOWARE=true`

**Special Handling:**
- Inbound messages with body matching STOP keywords → Opt-out handling
- STOP keywords: `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`, `OPT-OUT`, `OPTOUT`

---

## Source of Truth Configuration

### Contact Source of Truth

**Configuration:** `CONTACT_SOURCE_OF_TRUTH` environment variable  
**Default:** `merge`  
**Options:** `ghl` | `aloware` | `merge`

#### Mode: `merge` (Default)

**Behavior:**
- Both systems are considered equal sources
- Field-level merge rules applied (see Conflict Resolution below)
- Merged contact written to both systems
- Most recent `updatedAt` timestamp wins for overall update time

**Use Case:** When both systems may have valid updates

#### Mode: `ghl`

**Behavior:**
- GHL is the authoritative source
- GHL contact data always wins in conflicts
- Changes in GHL → synced to Aloware
- Changes in Aloware → synced to GHL, but GHL data takes precedence

**Use Case:** When GHL is the primary CRM system

#### Mode: `aloware`

**Behavior:**
- Aloware is the authoritative source
- Aloware contact data always wins in conflicts
- Changes in Aloware → synced to GHL
- Changes in GHL → synced to Aloware, but Aloware data takes precedence

**Use Case:** When Aloware is the primary contact system

### Conflict Resolution Rules (Merge Mode)

When `CONTACT_SOURCE_OF_TRUTH=merge`, field-level rules apply:

| Field | Rule | Notes |
|-------|------|-------|
| **Phone** | Never overwrite once set unless new is E.164-valid and old is not | E.164 format: `+[country][number]` |
| **Email** | Prefer non-empty; if both differ → keep GHL, record conflict | Conflict logged in decisions array |
| **Name** | Prefer longer non-empty string | More informative name wins |
| **Timezone** | Prefer GHL | GHL timezone preferred |
| **Address** | Prefer GHL unless missing | GHL address data preferred |
| **Tags** | Union + de-dupe; preserve `SYS:` prefixed tags | System tags never removed |
| **Custom Fields** | Merge with GHL precedence | GHL custom fields take priority |

**Decision Tracking:**
- All merge decisions recorded in `decisions[]` array for audit
- Each decision includes: `field`, `value`, `source`, `reason`

---

## Data Flow Diagrams

### Flow 1: Aloware Contact Created/Updated

```
┌──────────┐
│ Aloware  │ Contact created/updated
└────┬─────┘
     │
     │ POST /api/webhooks/aloware
     │ Event: ContactCreated/ContactUpdated
     ▼
┌─────────────────┐
│  Webhook Handler│ Store in webhook_events
│  (route.ts)     │ status='pending'
└────┬────────────┘
     │
     │ Enqueue (via /api/jobs/enqueue-pending)
     ▼
┌─────────────────┐
│  Worker Process │ Claim event (atomic status update)
│  (worker.ts)    │ status='pending' → 'processing'
└────┬────────────┘
     │
     │ Route via router.ts
     ▼
┌──────────────────────┐
│  Event Router        │ Detect entityType='contact'
│  (router.ts)         │
└────┬─────────────────┘
     │
     │ Check loop prevention
     │ (detectMiddlewareOrigin)
     │
     ├─→ If middleware-originated: Skip sync, mark done
     │
     └─→ If external: Continue
          │
          ▼
┌──────────────────────┐
│  Fetch Contact       │ GET /contacts/{id} from Aloware
│  (aloware/client.ts) │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│  Sync to GHL         │ syncAlowareContactToGHL()
│  (contact-sync.ts)   │
└────┬─────────────────┘
     │
     ├─→ Check contact_mappings table
     │   ├─→ If mapping exists: Update GHL contact
     │   └─→ If no mapping: Search/create GHL contact
     │
     ├─→ Create/update contact_mappings
     │
     ├─→ Write to sync_log (direction='aloware_to_ghl')
     │
     └─→ Update webhook_events status='done'
```

**Source of Truth Impact:**
- If `CONTACT_SOURCE_OF_TRUTH='aloware'`: Aloware data wins, written to GHL
- If `CONTACT_SOURCE_OF_TRUTH='ghl'`: Aloware data written to GHL, but GHL may overwrite later
- If `CONTACT_SOURCE_OF_TRUTH='merge'`: Aloware data merged with existing GHL data using field rules

---

### Flow 2: Aloware Call Completed

```
┌──────────┐
│ Aloware  │ Call completed
└────┬─────┘
     │
     │ POST /api/webhooks/aloware
     │ Event: OutboundPhoneCall-Completed / InboundPhoneCall-Completed
     ▼
┌─────────────────┐
│  Webhook Handler│ Store in webhook_events
│                 │ status='pending'
└────┬────────────┘
     │
     │ Enqueue
     ▼
┌─────────────────┐
│  Worker Process │ Claim event
└────┬────────────┘
     │
     ▼
┌──────────────────────┐
│  Event Router        │ Detect entityType='call'
│                      │
└────┬─────────────────┘
     │
     ├─→ GET /calls/{id} from Aloware
     │
     ├─→ Extract contact_id from call
     │
     └─→ GET /contacts/{contact_id} from Aloware
          │
          ▼
┌──────────────────────┐
│  Sync Call to GHL    │ syncAlowareCallToGHL()
│  (call-sync.ts)      │
└────┬─────────────────┘
     │
     ├─→ Ensure contact is synced first
     │   (calls syncAlowareContactToGHL)
     │
     ├─→ Build call note:
     │   "Call Made/Received on {date} ({duration})
     │    Disposition: {disposition}
     │    Status: {status}"
     │
     ├─→ Append note to GHL contact
     │
     ├─→ Add tags to GHL contact:
     │   - "Call: {disposition}"
     │   - "Inbound Call" or "Outbound Call"
     │
     ├─→ Write to sync_log
     │
     └─→ Update webhook_events status='done'
```

**Data Movement:**
- Call data (notes, tags) → GHL contact record
- No contact data sync (only call metadata)

---

### Flow 3: GHL Contact Created/Updated

```
┌──────┐
│ GHL  │ Contact created/updated
└──┬───┘
   │
   │ POST /api/webhooks/ghl
   │ Event: contact.created / contact.updated
   ▼
┌─────────────────┐
│  Webhook Handler│ Store in webhook_events
│                 │ status='pending'
└────┬────────────┘
     │
     │ Enqueue
     ▼
┌─────────────────┐
│  Worker Process │ Claim event
└────┬────────────┘
     │
     ▼
┌──────────────────────┐
│  Event Router        │ Detect entityType='contact'
│                      │ Check eventType in ['contact.created', 'contact.updated']
└────┬─────────────────┘
     │
     │ Check loop prevention
     │ (detectMiddlewareOrigin)
     │
     ├─→ If middleware-originated: Skip sync, mark done
     │
     └─→ If external: Continue
          │
          ▼
┌──────────────────────┐
│  Fetch Contact       │ GET /contacts/{id} from GHL
│  (ghl/client.ts)     │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│  Sync to Aloware     │ syncGHLContactToAloware()
│  (ghl-contact-sync.ts)│
└────┬─────────────────┘
     │
     ├─→ Check contact_mappings table
     │   ├─→ If mapping exists: Use alowareContactId
     │   └─→ If no mapping: Search/create Aloware contact
     │
     ├─→ Convert GHL contact to CanonicalContact
     ├─→ Convert Aloware contact to CanonicalContact
     │
     ├─→ Merge contacts (if CONTACT_SOURCE_OF_TRUTH='merge')
     │   └─→ Apply field-level merge rules
     │
     ├─→ Write merged contact to Aloware
     │   (and optionally back to GHL if merge requires)
     │
     ├─→ Update contact_mappings.lastSyncedAt
     │
     ├─→ Write to sync_log (direction='ghl_to_aloware')
     │
     └─→ Update webhook_events status='done'
```

**Source of Truth Impact:**
- If `CONTACT_SOURCE_OF_TRUTH='ghl'`: GHL data wins, written to Aloware
- If `CONTACT_SOURCE_OF_TRUTH='aloware'`: GHL data written to Aloware, but Aloware may overwrite later
- If `CONTACT_SOURCE_OF_TRUTH='merge'`: GHL data merged with existing Aloware data using field rules

---

### Flow 4: GHL Tag Added/Updated

```
┌──────┐
│ GHL  │ Tag added/updated to contact
└──┬───┘
   │
   │ POST /api/webhooks/ghl
   │ Event: *tag* (e.g., tag.added, contact.tagged)
   ▼
┌─────────────────┐
│  Webhook Handler│ Store in webhook_events
│                 │ status='pending'
└────┬────────────┘
     │
     │ Enqueue
     ▼
┌─────────────────┐
│  Worker Process │ Claim event
└────┬────────────┘
     │
     ▼
┌──────────────────────┐
│  Event Router        │ Detect entityType='tag' OR eventType contains "tag"
│                      │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│  Extract Tag Name    │ extractTagNameFromGhlPayload()
│  (ghl/tags.ts)       │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│  Sync Tag to List    │ syncGHLTagToAlowareList()
│  (list-sync.ts)      │
└────┬─────────────────┘
     │
     ├─→ Get all contact_mappings
     │
     ├─→ Filter mappings for contacts with tag
     │   (Note: Currently limited - relies on existing mappings)
     │
     ├─→ Extract Aloware contact IDs
     │
     ├─→ Create/update Aloware call list:
     │   - Name = GHL tag name
     │   - Contact IDs = Aloware contact IDs with tag
     │
     ├─→ Write to sync_log (direction='ghl_to_aloware')
     │
     └─→ Update webhook_events status='done'
```

**Data Movement:**
- GHL tag name → Aloware call list name
- Contacts with tag → Call list members

---

### Flow 5: Texting Message Received/Sent

```
┌──────────────┐
│ Texting      │ Message received/sent
│ System       │
└──────┬───────┘
       │
       │ POST /api/webhooks/texting
       │ Event: message.received / message.sent
       ▼
┌─────────────────┐
│  Webhook Handler│ Normalize payload
│                 │ Store in texting_webhook_events
│                 │ status='pending'
└────┬────────────┘
     │
     │ Enqueue (via /api/jobs/enqueue-texting-pending)
     ▼
┌─────────────────┐
│  Worker Process │ Claim event (texting queue)
│                 │ Check quarantine
└────┬────────────┘
     │
     ▼
┌──────────────────────┐
│  Texting Router      │ routeTextingEvent()
│  (texting/router.ts) │
└────┬─────────────────┘
     │
     ├─→ Check if STOP keyword in body
     │   └─→ If STOP: Handle opt-out (see Flow 6)
     │
     └─→ If normal message: Continue
          │
          ├─→ syncTextingMessageToGHL()
          │   │
          │   ├─→ Find/create GHL contact by phone
          │   │
          │   ├─→ Build message note:
          │   │   "[SMS][Inbound/Outbound] {timestamp}
          │   │    From: {from}
          │   │    To: {to}
          │   │    {body}"
          │   │
          │   ├─→ Append note to GHL contact
          │   │
          │   ├─→ Store in message_mappings
          │   │
          │   └─→ Write to sync_log
          │
          └─→ syncTextingMessageToAloware() (if TEXTING_SYNC_TO_ALOWARE=true)
              │
              ├─→ Find Aloware contact via contact_mappings
              │
              ├─→ Store in message_mappings
              │
              └─→ Write to sync_log (marked "not-supported" if no Aloware message API)
```

**Data Movement:**
- Message body → GHL contact notes
- Message metadata → message_mappings table
- Optionally → Aloware (if enabled)

---

### Flow 6: Texting STOP Opt-Out

```
┌──────────────┐
│ Texting      │ Message with "STOP" received
│ System       │
└──────┬───────┘
       │
       │ POST /api/webhooks/texting
       │ Event: message.received
       │ Body: "STOP" (or other STOP keywords)
       ▼
┌─────────────────┐
│  Webhook Handler│ Store in texting_webhook_events
└────┬────────────┘
     │
     │ Enqueue
     ▼
┌─────────────────┐
│  Worker Process │ Claim event
└────┬────────────┘
     │
     ▼
┌──────────────────────┐
│  Texting Router      │ Detect STOP keyword
│                      │ (isStop() check)
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│  Opt-Out Handling   │
│  (texting-to-ghl.ts) │
└────┬─────────────────┘
     │
     ├─→ Write to optout_registry:
     │   - phoneNumber: {from}
     │   - status: 'opted_out'
     │   - source: 'texting'
     │   - reason: 'STOP'
     │
     ├─→ Find/create GHL contact by phone
     │
     ├─→ Add tags to GHL contact:
     │   - "DNC-SMS"
     │   - "SMS Opted Out"
     │
     ├─→ Write to sync_log (entityType='optout')
     │
     └─→ Return early (no message sync)
```

**Data Movement:**
- Opt-out status → optout_registry table
- DNC tags → GHL contact
- Future outbound sends blocked (checked in `sendMessage()`)

---

## Event Routing Logic

### Router Decision Tree

```
Webhook Event Received
│
├─→ Check quarantine (if quarantined → skip, mark done)
│
├─→ Check loop prevention (if middleware-originated → skip, mark done)
│
└─→ Route by source:
    │
    ├─→ source='aloware'
    │   │
    │   ├─→ entityType='contact'
    │   │   └─→ syncAlowareContactToGHL()
    │   │
    │   ├─→ entityType='call'
    │   │   └─→ syncAlowareCallToGHL()
    │   │
    │   └─→ entityType='transcription'
    │       └─→ Mark "not-implemented", log only
    │
    ├─→ source='ghl'
    │   │
    │   ├─→ entityType='tag' OR eventType contains "tag"
    │   │   └─→ syncGHLTagToAlowareList()
    │   │
    │   └─→ entityType='contact' AND eventType in ['contact.created', 'contact.updated']
    │       └─→ syncGHLContactToAloware()
    │
    └─→ source='texting' (separate queue)
        │
        ├─→ eventType='message.received' OR 'message.sent'
        │   └─→ syncTextingMessageToGHL() + optionally syncTextingMessageToAloware()
        │
        └─→ eventType='optout.stop'
            └─→ Update optout_registry, tag GHL contact
```

---

## Data Movement Patterns

### Pattern 1: Unidirectional Sync (Aloware → GHL)

**Events:** Aloware contacts, calls  
**Direction:** One-way only  
**Source of Truth:** Aloware (for these entities)  
**Data Flow:**
- Aloware contact/call → Middleware → GHL contact
- No reverse sync for these entities

### Pattern 2: Bidirectional Sync (GHL ↔ Aloware)

**Events:** GHL contacts, Aloware contacts  
**Direction:** Two-way  
**Source of Truth:** Configurable (`CONTACT_SOURCE_OF_TRUTH`)  
**Data Flow:**
- GHL contact → Middleware → Aloware contact
- Aloware contact → Middleware → GHL contact
- Conflict resolution via merge rules or source preference

### Pattern 3: Tag-to-List Sync (GHL → Aloware)

**Events:** GHL tag changes  
**Direction:** One-way (GHL → Aloware)  
**Source of Truth:** GHL  
**Data Flow:**
- GHL tag → Middleware → Aloware call list
- Tag name becomes list name
- Contacts with tag become list members

### Pattern 4: Texting Sync (Texting → GHL/Aloware)

**Events:** Texting messages  
**Direction:** One-way (Texting → GHL, optionally → Aloware)  
**Source of Truth:** Texting system  
**Data Flow:**
- Texting message → Middleware → GHL contact notes
- Optionally → Aloware (if `TEXTING_SYNC_TO_ALOWARE=true`)
- Message metadata stored in `message_mappings`

### Pattern 5: Opt-Out Propagation (Texting → GHL)

**Events:** Texting STOP messages  
**Direction:** One-way (Texting → GHL)  
**Source of Truth:** Texting system (opt-out registry)  
**Data Flow:**
- STOP message → Middleware → optout_registry + GHL tags
- Future sends blocked via opt-out check

---

## Summary Table: All Events and Destinations

| Source | Event Type | Entity Type | Destination | Direction | Source of Truth |
|--------|-----------|-------------|-------------|-----------|-----------------|
| **Aloware** | `*Contact*` | `contact` | GHL | → | Aloware (for contacts) |
| **Aloware** | `*Call*` | `call` | GHL | → | Aloware (for calls) |
| **Aloware** | `*transcription*` | `transcription` | None | - | N/A (not implemented) |
| **GHL** | `contact.created` | `contact` | Aloware | → | Configurable |
| **GHL** | `contact.updated` | `contact` | Aloware | → | Configurable |
| **GHL** | `*tag*` | `tag` | Aloware | → | GHL |
| **Texting** | `message.received` | `message` | GHL, Aloware* | → | Texting |
| **Texting** | `message.sent` | `message` | GHL, Aloware* | → | Texting |
| **Texting** | `optout.stop` | `optout` | GHL (registry) | → | Texting |

*Aloware sync only if `TEXTING_SYNC_TO_ALOWARE=true`

---

## Loop Prevention

**Mechanism:** Origin detection via `detectMiddlewareOrigin()`

**Checks:**
- **GHL:** Tags containing `SYS:df_middleware_origin`, custom field `SYS:origin_id:<uuid>`
- **Aloware:** Notes/custom fields with middleware markers

**Behavior:**
- If middleware-originated event detected → Skip sync, mark done
- Prevents infinite sync loops when middleware updates trigger webhooks

**Note:** Origin markers are not currently written by middleware (future enhancement)

---

## Reconciliation

**Function:** `reconcileContacts()`  
**Purpose:** Ensure data consistency between systems  
**Process:**
1. Iterate through all `contact_mappings`
2. Verify GHL contacts exist
3. Sync contacts to ensure consistency
4. Log drift count, repairs count, errors

**Scheduling:** Can be run manually or scheduled (not yet configured)

---

**Document End**

