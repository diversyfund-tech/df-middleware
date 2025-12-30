# GHL Marketplace App Webhook Configuration

## Current Setup
- ✅ Delivery URL: `https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery`
- ❌ Webhooks: Not enabled (ConversationUnreadUpdate, InboundMessage)

## Webhook Types

### 1. Delivery URL (Already Set)
**Purpose:** Receives outbound messages sent from GHL agents
**Endpoint:** `/api/webhooks/ghl/provider-delivery`
**Status:** ✅ Configured

### 2. Event Webhooks (Not Enabled)
**Purpose:** Receive real-time events from GHL
**Types:**
- `ConversationUnreadUpdate` - When conversation unread status changes
- `InboundMessage` - When an inbound message is received

## Do We Need Event Webhooks?

**For Message Import:** ❌ NO
- We're importing historical messages via API
- Event webhooks are for real-time events, not imports
- Import endpoints don't require webhooks

**For Bidirectional Messaging:** ✅ MAYBE
- If we want to receive real-time inbound messages via webhook
- Currently we're syncing from Verity, not receiving from GHL
- The Delivery URL handles outbound (agent → Verity)

## Recommendation

**For now:** You don't need to enable the event webhooks for message imports to work. However, enabling them might help "activate" the provider in GHL's system.

**Try enabling:**
- `InboundMessage` webhook (if you want to receive inbound messages from GHL)
- Set webhook URL to: `https://df-middleware.vercel.app/api/webhooks/ghl` (if we have a handler)

**But:** The "Incorrect conversationProviderId/type" error is likely unrelated to webhook configuration. It's more about provider validation.

## Next Steps

1. **Try enabling webhooks** - It might activate the provider
2. **Keep Delivery URL** - Already configured correctly
3. **Test import again** - See if enabling webhooks fixes the validation error

