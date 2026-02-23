# GHL Provider Delivery Webhook - Implementation

## Overview

We've enabled bidirectional messaging so agents can send messages from GHL, which will be forwarded through Verity to Telnyx.

## Flow

```
Agent sends message in GHL
  ↓
GHL sends webhook to Delivery URL
  ↓
Middleware receives webhook at /api/webhooks/ghl/provider-delivery
  ↓
Middleware forwards to Verity API
  ↓
Verity sends via Telnyx
  ↓
Delivery status updates come back through Verity → Middleware
```

## Endpoint Created

**Path:** `POST /api/webhooks/ghl/provider-delivery`

**Production URL:**
```
https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery
```

**Development URL:**
```
http://localhost:3000/api/webhooks/ghl/provider-delivery
```

## What It Does

1. **Receives GHL Provider Webhooks**
   - When an agent sends a message through our provider
   - When message status updates occur

2. **Extracts Message Details**
   - Phone number (to)
   - Message body
   - GHL message ID
   - Conversation ID
   - Contact ID

3. **Forwards to Verity**
   - Uses existing `sendMessage()` function
   - Checks opt-out status before sending
   - Handles errors gracefully

4. **Stores Message Mapping**
   - Links GHL message ID to Verity message ID
   - Enables tracking and status updates

5. **Returns Response to GHL**
   - Success with Verity message ID
   - Error details if sending fails

## GHL Provider Configuration

**Delivery URL to set in GHL Marketplace App:**
```
https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery
```

## Expected Webhook Payload (from GHL)

```json
{
  "messageId": "ghl_msg_123",
  "conversationId": "conv_abc",
  "contactId": "contact_xyz",
  "phone": "+19195551212",
  "message": "Hello, how can I help?",
  "direction": "outbound",
  "type": "sms",
  "status": "sent"
}
```

## Response Format

**Success:**
```json
{
  "success": true,
  "messageId": "verity_msg_456",
  "ghlMessageId": "ghl_msg_123"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "messageId": "ghl_msg_123"
}
```

## Features

✅ **Opt-out Checking**: Automatically checks opt-out registry before sending  
✅ **Error Handling**: Returns appropriate errors to GHL  
✅ **Message Mapping**: Tracks GHL ↔ Verity message relationships  
✅ **Status Updates**: Handles delivery status webhooks  
✅ **Logging**: Comprehensive logging for debugging

## Next Steps

1. ✅ Code implemented
2. ⏳ Set Delivery URL in GHL Marketplace App provider settings
3. ⏳ Test sending a message from GHL
4. ⏳ Verify message appears in Verity and is sent via Telnyx
5. ⏳ Test delivery status updates

## Testing

Once configured, test by:
1. Sending a message from GHL (agent interface)
2. Check logs for webhook receipt
3. Verify message appears in Verity
4. Verify message is sent via Telnyx
5. Check delivery status updates

---

**Status:** ✅ Ready for testing once Delivery URL is configured in GHL Marketplace App




