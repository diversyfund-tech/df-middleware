# GHL Webhook → Database → Verity Sync Flow

## Complete Flow Diagram

```
GHL sends webhook
  ↓
POST /api/webhooks/ghl
  ↓
1. Store in webhook_events table (status: "pending")
  ↓
2. Auto-enqueue job in pg-boss (WEBHOOK_EVENT_QUEUE)
  ↓
3. Forward webhook to Verity (if VERITY_BASE_URL configured)
  ↓
4. Return 200 OK immediately
  ↓
[ASYNC PROCESSING]
  ↓
Worker picks up job from queue
  ↓
5. Update status to "processing"
  ↓
6. Route event via routeWebhookEvent()
  ↓
7. For appointment events:
   - Extract appointmentId and contactId
   - Call syncGHLAppointmentToVerity()
   - Updates Verity's leads table with ghl_appointment_id
  ↓
8. Update status to "done"
```

## Step-by-Step Breakdown

### Step 1: Webhook Received (`/api/webhooks/ghl`)

**File:** `src/app/api/webhooks/ghl/route.ts`

**What happens:**
1. ✅ **Stores event in database** - Inserts into `webhook_events` table:
   ```typescript
   await db.insert(webhookEvents).values({
     source: "ghl",
     eventType: "contact.updated",
     entityType: "contact",
     entityId: "ldErVVX2S2v8Vk5gvHME",
     payloadJson: body,
     dedupeKey: "...",
     status: "pending",
   })
   ```

2. ✅ **Auto-enqueues for processing** - Sends job to pg-boss queue:
   ```typescript
   await boss.send(WEBHOOK_EVENT_QUEUE, {
     webhookEventId: insertedEventId,
   })
   ```

3. ✅ **Forwards to Verity** (if `VERITY_BASE_URL` is configured):
   ```typescript
   await fetch(`${VERITY_BASE_URL}/api/integrations/ghl/webhook`, {
     method: "POST",
     body: bodyText,
   })
   ```

4. ✅ **Returns 200 OK** - Webhook handler responds immediately

### Step 2: Async Processing (Worker)

**File:** `src/scripts/worker.ts` or `/api/jobs/process-pending`

**What happens:**
1. Worker picks up job from queue
2. Loads event from `webhook_events` table
3. Updates status to `"processing"`
4. Calls `routeWebhookEvent(event)`

### Step 3: Event Routing (`routeWebhookEvent`)

**File:** `src/lib/events/router.ts`

**What happens:**
- Routes to `routeGhLEvent()` for GHL events
- Handles different entity types (contact, appointment, tag, etc.)

### Step 4: Appointment Event Processing

**File:** `src/lib/events/router.ts` (lines 593-704)

**For appointment events:**
1. Extracts `appointmentId` and `contactId` from payload
2. If `contactId` missing, fetches appointment from GHL API
3. If still missing, searches GHL contact by phone/email
4. Calls `syncGHLAppointmentToVerity(appointmentId, contactId)`

### Step 5: Sync to Verity (`syncGHLAppointmentToVerity`)

**File:** `src/lib/sync/appointment-sync.ts`

**What happens:**
1. **Finds Verity contact:**
   - Checks `contact_mappings` table for GHL contact ID
   - If found, uses phone/email from mapping
   - If not found, fetches GHL contact to get phone/email
   - Searches Verity's `contacts` table by phone or email

2. **Updates Verity's `leads` table:**
   ```sql
   -- If lead exists:
   UPDATE leads
   SET ghl_appointment_id = 'appointment_id',
       last_activity_at = NOW()
   WHERE contact_id = 'verity_contact_id'

   -- If lead doesn't exist:
   INSERT INTO leads (contact_id, ghl_appointment_id, created_at, last_activity_at)
   VALUES ('verity_contact_id', 'appointment_id', NOW(), NOW())
   ```

3. **Syncs tags** (optional):
   - Fetches tags from GHL contact
   - Adds tags to GHL contact (via API)

## Database Updates

### Our Database (DF Middleware)

**Table: `webhook_events`**
- ✅ **Stored immediately** when webhook received
- Status: `pending` → `processing` → `done` (or `error`)
- Contains full payload JSON

**Table: `sync_log`**
- ✅ **Created during processing**
- Tracks sync operations
- Records success/error status

**Table: `contact_mappings`**
- ✅ **Used for lookups**
- Maps GHL contact IDs to Aloware contact IDs
- Contains phone/email for matching

### Verity Database

**Table: `leads`**
- ✅ **Updated during appointment sync**
- Field: `ghl_appointment_id` - Stores GHL appointment ID
- Field: `last_activity_at` - Updated timestamp
- Used for broadcast analytics calculation

**Table: `contacts`**
- ✅ **Queried for matching**
- Matched by `phone_e164` or `email`
- Not directly updated (only `leads` table is updated)

## Contact Events vs Appointment Events

### Contact Events (`contact.updated`, `contact.created`)

**Flow:**
1. Stored in `webhook_events` ✅
2. Forwarded to Verity (if configured) ✅
3. Synced to Aloware (not Verity) ✅
4. **Verity gets webhook forward, but no direct database update**

### Appointment Events (`appointment.created`, `appointment.updated`)

**Flow:**
1. Stored in `webhook_events` ✅
2. Forwarded to Verity (if configured) ✅
3. **Synced to Verity's `leads` table** ✅
   - Updates `ghl_appointment_id` field
   - Used for analytics calculation

## Key Points

1. ✅ **Yes, we update our database** - Every webhook is stored in `webhook_events` table
2. ✅ **Yes, we sync to Verity** - But only for appointment events (updates `leads` table)
3. ✅ **Contact events** - Forwarded to Verity via webhook, but Verity handles its own database updates
4. ✅ **Appointment events** - Directly update Verity's `leads` table with `ghl_appointment_id`

## Verification

To check if syncing is working:

1. **Check our database:**
   ```sql
   SELECT * FROM webhook_events 
   WHERE source = 'ghl' 
   ORDER BY received_at DESC 
   LIMIT 10;
   ```

2. **Check Verity's leads table:**
   ```sql
   SELECT * FROM leads 
   WHERE ghl_appointment_id IS NOT NULL 
   ORDER BY last_activity_at DESC 
   LIMIT 10;
   ```

3. **Check sync logs:**
   ```sql
   SELECT * FROM sync_log 
   WHERE entity_type = 'appointment' 
   ORDER BY started_at DESC 
   LIMIT 10;
   ```
