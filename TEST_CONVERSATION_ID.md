# Test Plan: conversationId Fix Verification

**Date:** January 27, 2025  
**Purpose:** Verify conversationId is correctly included and used

---

## Test 1: Outbound Message with conversationId

### Step 1: Create Test Webhook Event with conversationId

```bash
curl -X POST https://df-middleware.vercel.app/api/test/texting-webhook \
  -H "Content-Type: application/json" \
  -d @test-conversation-id-payload.json
```

**Expected:**
- Event created with `conversationId: "test_verity_conversation_123"`
- Payload includes conversationId

### Step 2: Process Event

```bash
# Get the event ID from Step 1, then:
curl -X POST https://df-middleware.vercel.app/api/test/process-texting-event \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<event-id-from-step-1>"}'
```

**Check Logs For:**
- `[texting-to-ghl]` - Should show conversationId being used
- `[GHL]` - Should show conversationId in API call to GHL
- `sendOutboundMessage` - Should receive conversationId parameter

### Step 3: Verify in Database

```sql
-- Check webhook event has conversationId
SELECT id, event_type, conversation_id, payload_json->>'conversationId' as conv_id_in_payload
FROM texting_webhook_events 
WHERE message_id = 'test_conv_id_verification'
ORDER BY received_at DESC LIMIT 1;

-- Check message mapping
SELECT * FROM message_mappings 
WHERE texting_message_id = 'test_conv_id_verification';
```

**Expected:**
- ✅ `conversation_id` column has value
- ✅ `payload_json` contains `conversationId`
- ✅ Message mapping created

### Step 4: Verify in GHL

1. Go to GHL Dashboard
2. Search for phone: `+19492459055`
3. Check conversation - should use Verity's conversationId
4. Verify message appears in correct conversation (not duplicate)

---

## Test 2: Real Verity Outbound Message

### Step 1: Send Message from Verity

```bash
curl -X POST https://verity.diversyfund.com/api/integrations/df-middleware/send-message \
  -H "Authorization: Bearer <VERITY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+19492459055",
    "body": "Real test message - conversationId verification",
    "conversationId": "verity_chat_456"
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

### Step 2: Check Verity Webhook Payload

Wait 5-10 seconds for Verity to send webhook, then check database:

```sql
SELECT 
  id,
  event_type,
  conversation_id,
  payload_json->>'conversationId' as conv_id_in_payload,
  payload_json->'raw'->>'chatId' as chat_id_in_raw,
  received_at
FROM texting_webhook_events 
WHERE to_number = '+19492459055'
  AND event_type = 'message.sent'
ORDER BY received_at DESC 
LIMIT 1;
```

**Expected:**
- ✅ `conversation_id` column populated
- ✅ `payload_json->>'conversationId'` matches Verity's chatId
- ✅ `payload_json->'raw'->>'chatId'` also present

### Step 3: Process Event and Verify GHL Call

Process the event and check server logs for:

```
[texting-to-ghl] Processing message with conversationId: <verity-chat-id>
[GHL] Calling /conversations/messages/outbound with conversationId: <verity-chat-id>
```

**Expected:**
- ✅ conversationId passed to `sendOutboundMessage`
- ✅ GHL API call includes conversationId
- ✅ Message appears in correct GHL conversation

---

## Test 3: Inbound Message with conversationId

### Step 1: Create Inbound Test Event

```bash
curl -X POST https://df-middleware.vercel.app/api/test/texting-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "message.received",
    "direction": "inbound",
    "from": "+19492459055",
    "to": "+15559876543",
    "body": "Inbound test with conversationId",
    "messageId": "test_inbound_conv_123",
    "conversationId": "verity_inbound_chat_789",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

### Step 2: Process and Verify

Same steps as Test 1, but verify:
- ✅ conversationId used for inbound message
- ✅ GHL API call includes conversationId (optional for inbound, but should be used if provided)

---

## Success Criteria

✅ **Verity Outbound Webhook:**
- Includes `conversationId` in payload
- Includes `chatId` in raw payload

✅ **DF Middleware:**
- Receives `conversationId` from Verity webhook
- Passes `conversationId` to GHL API calls
- Uses `conversationId` for both inbound and outbound

✅ **GHL:**
- Receives `conversationId` in API calls
- Messages appear in correct conversations
- No duplicate conversations created

---

## Quick Test Command

Run this to test everything at once:

```bash
# Test outbound with conversationId
curl -X POST https://df-middleware.vercel.app/api/test/texting-webhook \
  -H "Content-Type: application/json" \
  -d @test-conversation-id-payload.json

# Then process the event (replace <event-id>)
curl -X POST https://df-middleware.vercel.app/api/test/process-texting-event \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<event-id>"}'
```


