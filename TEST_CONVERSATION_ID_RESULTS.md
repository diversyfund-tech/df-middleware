# conversationId Test Results

**Date:** January 27, 2025  
**Test Event ID:** `b88abbc3-b82a-4a38-9f25-b026d3f5a945`

---

## Test 1: Simulated Outbound Message with conversationId ✅

### Step 1: Create Test Webhook Event ✅
**Status:** SUCCESS  
**Event ID:** `b88abbc3-b82a-4a38-9f25-b026d3f5a945`  
**Payload:**
- `conversationId`: `"test_verity_conversation_123"`
- `messageId`: `"test_conv_id_verification"`
- `direction`: `"outbound"`
- `to`: `"+19492459055"`

**Response:**
```json
{
  "success": true,
  "message": "Test texting webhook event created",
  "event": {
    "id": "b88abbc3-b82a-4a38-9f25-b026d3f5a945",
    "eventType": "message.sent",
    "status": "pending"
  }
}
```

### Step 2: Process Event ✅
**Status:** SUCCESS  
**Result:**
- Status changed: `pending` → `done`
- No errors reported
- Event processed successfully

**Response:**
```json
{
  "success": true,
  "message": "Event processed",
  "event": {
    "id": "b88abbc3-b82a-4a38-9f25-b026d3f5a945",
    "status": "done",
    "eventType": "message.sent",
    "errorMessage": null
  }
}
```

---

## Verification Steps Needed

### 1. Check Database for conversationId

```sql
-- Verify webhook event has conversationId
SELECT 
  id,
  event_type,
  conversation_id,
  payload_json->>'conversationId' as conv_id_in_payload,
  status
FROM texting_webhook_events 
WHERE id = 'b88abbc3-b82a-4a38-9f25-b026d3f5a945';

-- Check message mapping
SELECT 
  texting_message_id,
  ghl_message_id,
  conversation_id,
  direction
FROM message_mappings 
WHERE texting_message_id = 'test_conv_id_verification';
```

**Expected:**
- ✅ `conversation_id` column has value: `"test_verity_conversation_123"`
- ✅ `payload_json->>'conversationId'` matches
- ✅ Message mapping created with conversationId

### 2. Check Server Logs

Look for these log entries:
```
[texting-to-ghl] Processing message with conversationId: test_verity_conversation_123
[GHL] Calling /conversations/messages/outbound with conversationId: test_verity_conversation_123
```

**Expected:**
- ✅ conversationId logged when processing
- ✅ conversationId passed to GHL API call

### 3. Verify in GHL Dashboard

1. Go to GHL Dashboard
2. Search for phone: `+19492459055`
3. Check conversation:
   - ✅ Message appears: "Test message with conversationId - verifying fix"
   - ✅ Message is outbound
   - ✅ Conversation ID matches (if GHL exposes it)

---

## Next Test: Real Verity Message

To test with a real Verity message:

```bash
curl -X POST https://verity.diversyfund.com/api/integrations/df-middleware/send-message \
  -H "Authorization: Bearer <VERITY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+19492459055",
    "body": "Real test - conversationId verification",
    "conversationId": "verity_chat_456"
  }'
```

**Then check:**
1. Verity webhook payload includes `conversationId`
2. DF Middleware uses it when calling GHL
3. Message appears in correct GHL conversation

---

## Summary

✅ **Test Event Created:** Successfully created with conversationId  
✅ **Event Processed:** Successfully processed without errors  
⏳ **Verification Needed:** Check database, logs, and GHL dashboard

**Next Steps:**
1. Check database to verify conversationId stored correctly
2. Check server logs to verify conversationId used in GHL API call
3. Verify message in GHL dashboard
4. Test with real Verity message to verify end-to-end flow

---

**Status:** ✅ Initial tests passed - verification in progress


