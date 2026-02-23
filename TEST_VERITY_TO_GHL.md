# Test Guide: Verity → GHL Message Sync

This guide walks through testing that messages sent from Verity properly sync to GHL.

## Prerequisites

1. Server must be running (either locally or on Vercel)
2. Environment variables configured:
   - `VERITY_BASE_URL`
   - `VERITY_API_KEY`
   - `GHL_CONVERSATION_PROVIDER_ID`
   - `X_DF_JOBS_SECRET` (for job processing)

## Quick Test (Automated Script)

Run the automated test script:

```bash
# Replace +19195551234 with your phone number
tsx scripts/test-verity-to-ghl-sync.ts +19195551234
```

The script will:
1. Create a simulated webhook event
2. Process it and sync to GHL
3. Send a real message from Verity
4. Verify the real message syncs to GHL

## Manual Test Steps

### Phase 1: Simulated Webhook Test

#### Step 1: Create Test Webhook Event

```bash
curl -X POST http://localhost:3000/api/test/texting-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "message.sent",
    "direction": "outbound",
    "from": "+15559876543",
    "to": "+19195551234",
    "body": "Test message from Verity - simulated",
    "messageId": "test_msg_simulated_'$(date +%s)'",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test texting webhook event created",
  "event": {
    "id": "<event-id>",
    "eventType": "message.sent",
    "status": "pending",
    "entityId": "<entity-id>"
  },
  "nextStep": "Call /api/jobs/enqueue-texting-pending to process this event"
}
```

**Save the `event.id` for the next step.**

#### Step 2: Process the Event

**Option A: Direct Processing (Test Endpoint)**

```bash
curl -X POST http://localhost:3000/api/test/process-texting-event \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "<event-id-from-step-1>"
  }'
```

**Option B: Job Queue Processing (Realistic Flow)**

```bash
curl -X POST http://localhost:3000/api/jobs/enqueue-texting-pending \
  -H "Content-Type: application/json" \
  -H "X-DF-JOBS-SECRET: <your-secret>"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Event processed",
  "event": {
    "id": "<event-id>",
    "status": "done",
    "eventType": "message.sent"
  }
}
```

#### Step 3: Verify in GHL

1. Log into GHL dashboard
2. Navigate to Conversations
3. Search for phone number: `+19195551234`
4. Verify:
   - ✅ Contact exists (or was created)
   - ✅ Conversation exists
   - ✅ Message appears as **outbound** message
   - ✅ Message body: "Test message from Verity - simulated"

**Check Database:**

```sql
-- Check message mapping
SELECT * FROM message_mappings 
WHERE to_number = '+19195551234' 
ORDER BY created_at DESC LIMIT 1;

-- Check sync log
SELECT * FROM sync_log 
WHERE direction = 'texting_to_ghl' 
ORDER BY finished_at DESC LIMIT 1;
```

### Phase 2: Real Verity Message Test

#### Step 4: Send Real Message from Verity

```bash
curl -X POST https://verity.diversyfund.com/api/integrations/df-middleware/send-message \
  -H "Authorization: Bearer <VERITY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+19195551234",
    "body": "Real test message from Verity - '$(date +%Y-%m-%d\ %H:%M:%S)'"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "<verity-message-id>",
  "chatId": "<chat-id>",
  "status": "pending"
}
```

**Check your phone** - you should receive the SMS message.

**Wait 5-10 seconds** for Verity to send the webhook to the middleware.

#### Step 5: Verify Webhook Received

Check the database for the new webhook event:

```sql
SELECT * FROM texting_webhook_events 
WHERE event_type = 'message.sent' 
  AND direction = 'outbound'
  AND to_number = '+19195551234'
ORDER BY received_at DESC 
LIMIT 1;
```

Verify:
- ✅ `event_type` = `'message.sent'`
- ✅ `status` = `'pending'`
- ✅ `to_number` matches your phone number
- ✅ `payload_json` contains the message body

#### Step 6: Process Real Message Webhook

**Option A: Process Specific Event**

```bash
# First, get the event ID from the database query above
curl -X POST http://localhost:3000/api/test/process-texting-event \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "<event-id-from-database>"
  }'
```

**Option B: Process All Pending Events**

```bash
curl -X POST http://localhost:3000/api/jobs/enqueue-texting-pending \
  -H "Content-Type: application/json" \
  -H "X-DF-JOBS-SECRET: <your-secret>"
```

**Expected Response:**
```json
{
  "enqueued": 1,
  "totalPending": 0
}
```

#### Step 7: Verify Real Message in GHL

1. Check GHL Conversations again
2. Verify:
   - ✅ New message appears in the conversation
   - ✅ Message is marked as **outbound**
   - ✅ Message body matches what was sent
   - ✅ Timestamp is correct

**Check Database:**

```sql
-- Verify message mapping
SELECT 
  mm.*,
  twe.event_type,
  twe.status
FROM message_mappings mm
JOIN texting_webhook_events twe ON mm.texting_message_id = twe.entity_id
WHERE mm.to_number = '+19195551234'
ORDER BY mm.created_at DESC 
LIMIT 5;

-- Verify sync log
SELECT * FROM sync_log 
WHERE direction = 'texting_to_ghl' 
  AND entity_type = 'message'
ORDER BY finished_at DESC 
LIMIT 5;
```

## Troubleshooting

### Messages Not Appearing in GHL

1. **Check Sync Log:**
   ```sql
   SELECT * FROM sync_log 
   WHERE direction = 'texting_to_ghl' 
   ORDER BY finished_at DESC 
   LIMIT 10;
   ```
   Look for `error_message` field.

2. **Verify GHL Configuration:**
   - `GHL_CONVERSATION_PROVIDER_ID` is set
   - OAuth tokens are valid (check `ghl_oauth_tokens` table)
   - Location ID is correct

3. **Check Event Status:**
   ```sql
   SELECT id, event_type, status, error_message 
   FROM texting_webhook_events 
   WHERE status = 'error'
   ORDER BY received_at DESC 
   LIMIT 10;
   ```

### Webhook Not Received

1. **Check Verity Configuration:**
   - `DF_MIDDLEWARE_WEBHOOK_URL` is set correctly in Verity
   - `VERITY_WEBHOOK_SECRET` matches in both systems
   - Verity logs show webhook forwarding

2. **Check Middleware Webhook Endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/texting \
     -H "X-Texting-Secret: <VERITY_WEBHOOK_SECRET>" \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

### Event Not Processing

1. **Check Event Status:**
   ```sql
   SELECT id, status, error_message 
   FROM texting_webhook_events 
   WHERE status = 'pending' OR status = 'error'
   ORDER BY received_at DESC;
   ```

2. **Manually Process:**
   ```bash
   curl -X POST http://localhost:3000/api/test/process-texting-event \
     -H "Content-Type: application/json" \
     -d '{"eventId": "<event-id>"}'
   ```

## Success Criteria

- ✅ Simulated webhook creates event in database
- ✅ Event processes successfully (status: "done")
- ✅ Message appears in GHL as outbound
- ✅ Contact created/updated in GHL
- ✅ Message mapping stored correctly
- ✅ Real message sent from Verity
- ✅ Real message webhook received
- ✅ Real message appears in GHL

## Notes

- Replace `+19195551234` with your actual phone number
- Replace `http://localhost:3000` with your actual BASE_URL if different
- Replace `<VERITY_API_KEY>` with your actual API key
- Replace `<your-secret>` with your actual `X_DF_JOBS_SECRET`



