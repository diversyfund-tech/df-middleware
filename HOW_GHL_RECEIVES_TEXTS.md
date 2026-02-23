# How GHL Receives Texts - Complete Flow

**Date:** January 27, 2025

---

## Two Different Flows

GHL receives texts in **two different ways** depending on the direction:

### 1. Inbound Messages (Customer → Agent)

**GHL does NOT receive webhooks for inbound messages.**

Instead, **DF Middleware actively pushes messages to GHL** via API calls:

```
Customer sends SMS
  ↓
Telnyx receives SMS
  ↓
Telnyx → Verity (webhook)
  ↓
Verity → DF Middleware (/api/webhooks/texting)
  ↓
DF Middleware processes webhook
  ↓
DF Middleware → GHL API (POST /conversations/messages/inbound) ← ACTIVE PUSH
  ↓
GHL receives message and displays in conversation
```

**Key Point:** GHL doesn't have a webhook URL for inbound messages. DF Middleware **calls GHL's API** to add messages.

**Code Location:**
- `src/lib/sync/texting-to-ghl.ts` - Receives webhook from Verity
- `src/lib/ghl/conversations.ts` - Calls GHL API to add message

---

### 2. Outbound Messages (Agent → Customer)

**GHL sends webhooks TO DF Middleware** via the Delivery URL:

```
Agent sends message in GHL
  ↓
GHL → DF Middleware (/api/webhooks/ghl/provider-delivery) ← DELIVERY URL
  ↓
DF Middleware receives webhook
  ↓
DF Middleware → Verity API (/api/integrations/df-middleware/send-message)
  ↓
Verity → Telnyx
  ↓
Message sent to customer
```

**Key Point:** The Delivery URL (`/api/webhooks/ghl/provider-delivery`) is where **GHL sends webhooks TO DF Middleware** when agents send messages.

**Code Location:**
- `src/app/api/webhooks/ghl/provider-delivery/route.ts` - Receives webhook from GHL
- `src/lib/texting/client.ts` - Calls Verity API to send message

---

## Summary

| Direction | How GHL Receives | Endpoint/API |
|-----------|------------------|--------------|
| **Inbound** (Customer → Agent) | DF Middleware **calls GHL API** | `POST /conversations/messages/inbound` |
| **Outbound** (Agent → Customer) | GHL **sends webhook** to DF Middleware | `POST /api/webhooks/ghl/provider-delivery` (Delivery URL) |

---

## The Delivery URL Explained

**What is the Delivery URL?**

The Delivery URL is **NOT** where GHL receives messages. It's where **GHL sends webhooks** when agents send messages through your provider.

**Flow:**
```
Agent sends message in GHL
  ↓
GHL sends webhook to Delivery URL (your endpoint)
  ↓
Your endpoint receives webhook and forwards to Verity
```

**Think of it as:**
- **Delivery URL** = "Where should GHL send webhooks when agents send messages?"
- **NOT** = "Where does GHL receive messages?"

---

## Complete Bidirectional Flow

### Inbound Flow (Customer → Agent)
```
Customer SMS
  ↓
Telnyx
  ↓
Verity (webhook)
  ↓
DF Middleware (/api/webhooks/texting) ← Receives webhook
  ↓
DF Middleware → GHL API (POST /conversations/messages/inbound) ← Calls API
  ↓
GHL displays message
```

### Outbound Flow (Agent → Customer)
```
Agent sends in GHL
  ↓
GHL → DF Middleware (/api/webhooks/ghl/provider-delivery) ← Sends webhook
  ↓
DF Middleware → Verity API (/api/integrations/df-middleware/send-message) ← Calls API
  ↓
Verity → Telnyx
  ↓
Customer receives SMS
```

---

## Why This Design?

**Inbound Messages:**
- GHL doesn't have a webhook system for receiving inbound messages from providers
- Instead, providers must **actively push** messages to GHL via API
- This is why DF Middleware calls `POST /conversations/messages/inbound`

**Outbound Messages:**
- When agents send messages, GHL needs to notify the provider
- GHL sends webhooks to the provider's Delivery URL
- Provider receives webhook and sends message via their carrier (Telnyx)

---

## Key Takeaways

1. ✅ **Delivery URL** = Where GHL sends webhooks (outbound messages)
2. ✅ **GHL API** = Where DF Middleware pushes messages (inbound messages)
3. ✅ **No webhook needed** for inbound - DF Middleware actively calls GHL API
4. ✅ **Delivery URL needed** for outbound - GHL sends webhooks to your endpoint

---

## Verification

To verify everything is working:

**Inbound Messages:**
- Check DF Middleware logs for: `[texting-to-ghl] Successfully created message in GHL`
- Check GHL dashboard - message should appear in conversation

**Outbound Messages:**
- Check DF Middleware logs for: `[ghl.provider-delivery] Received provider delivery webhook`
- Check DF Middleware logs for: `[ghl.provider-delivery] Message sent via Verity`
- Message should be sent to customer

---

**Bottom Line:** The Delivery URL is for **outbound** messages (GHL → DF Middleware). For **inbound** messages, DF Middleware actively calls GHL's API to add messages.


