# Verity Configuration Clarification

**Date:** January 27, 2025

---

## 🔴 CRITICAL: conversationId IS Required

You're absolutely right - I was wrong to say `conversationId` is optional. 

**For outbound messages, GHL REQUIRES `conversationId`.** The error we saw earlier was:
```
"No conversationId passed in body"
```

This means:
- ✅ **Inbound messages:** Can create conversations automatically
- ❌ **Outbound messages:** MUST have `conversationId` - GHL API will reject without it

**Impact:** The missing `conversationId` in Verity's outbound webhook payload is **CRITICAL** and must be fixed.

---

## Environment Variables Configuration

### Three Variables in Verity

These need to be set in **Verity's environment** (Doppler or `.env.local`):

```bash
# 1. Where Verity forwards webhooks TO (DF Middleware's webhook endpoint)
DF_MIDDLEWARE_WEBHOOK_URL=https://df-middleware.vercel.app/api/webhooks/texting

# 2. Secret for webhook authentication (shared secret)
DF_MIDDLEWARE_WEBHOOK_SECRET=8e3d9345c580e8069f981a78663f9214f136e3082cbf75b7d388feebf38e8fac

# 3. API key for DF Middleware to authenticate when calling Verity (shared secret)
DF_MIDDLEWARE_API_KEY=622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c
```

**Where to set:** Verity's environment (Doppler, Vercel, or `.env.local`)

---

### Three Variables in DF Middleware

These need to be set in **DF Middleware's environment** (Vercel or `.env.local`):

```bash
# 1. Verity's base URL (where DF Middleware calls Verity's API)
VERITY_BASE_URL=https://verity.diversyfund.com

# 2. API key for DF Middleware to authenticate when calling Verity (same as DF_MIDDLEWARE_API_KEY above)
VERITY_API_KEY=622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c

# 3. Secret for webhook authentication (same as DF_MIDDLEWARE_WEBHOOK_SECRET above)
VERITY_WEBHOOK_SECRET=8e3d9345c580e8069f981a78663f9214f136e3082cbf75b7d388feebf38e8fac
```

**Where to set:** DF Middleware's Vercel environment variables

---

## URL Matching Requirements

### ✅ Correct URLs

**Verity → DF Middleware (Webhooks):**
- Verity's `DF_MIDDLEWARE_WEBHOOK_URL` = `https://df-middleware.vercel.app/api/webhooks/texting`
- This is where Verity forwards Telnyx webhooks

**DF Middleware → Verity (API Calls):**
- DF Middleware's `VERITY_BASE_URL` = `https://verity.diversyfund.com`
- DF Middleware calls: `https://verity.diversyfund.com/api/integrations/df-middleware/send-message`

### ❌ GHL Does NOT Need Verity URL

**GHL → DF Middleware (Provider Delivery Webhooks):**
- GHL sends to: `https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery`
- This is configured in GHL Marketplace App settings (Delivery URL)
- **GHL never calls Verity directly** - it only calls DF Middleware

**Flow:**
```
GHL Agent sends message
  ↓
GHL sends webhook to DF Middleware (/api/webhooks/ghl/provider-delivery)
  ↓
DF Middleware calls Verity API (/api/integrations/df-middleware/send-message)
  ↓
Verity sends via Telnyx
```

---

## 404 Error Investigation

The endpoints are deployed (showing in logs):
```
├ ƒ /api/integrations/df-middleware/send-message
├ ƒ /api/integrations/df-middleware/webhook
```

But we got a 404 when calling:
```
https://verity.diversyfund.com/api/integrations/df-middleware/send-message
```

### Possible Causes:

1. **Environment Variable Missing:**
   - Check if `VERITY_BASE_URL` is set in DF Middleware's Vercel environment
   - Should be: `https://verity.diversyfund.com`

2. **Endpoint Path Issue:**
   - The endpoint exists: `/api/integrations/df-middleware/send-message`
   - DF Middleware calls: `${VERITY_BASE_URL}/api/integrations/df-middleware/send-message`
   - Full URL should be: `https://verity.diversyfund.com/api/integrations/df-middleware/send-message`

3. **Deployment Issue:**
   - Endpoints might not be deployed to production
   - Check Verity's production deployment logs
   - Verify the route is registered in Next.js

4. **Authentication Issue:**
   - 404 could be returned if authentication fails (some APIs return 404 instead of 401)
   - Verify `DF_MIDDLEWARE_API_KEY` matches `VERITY_API_KEY`

---

## Fix: Add conversationId to Outbound Webhooks

**File:** `/Users/jaredlutz/Github/verity/src/lib/comms/workflows/sendSms.ts`

**Current Code (Line 177-190):**
```typescript
const middlewarePayload = {
  eventType: "message.sent",
  messageId: telnyxMessageId,
  direction: "outbound",
  // ❌ MISSING conversationId
  from: payload.from,
  to: Array.isArray(payload.to) ? payload.to[0] : payload.to,
  body: payload.text || "",
  timestamp: new Date().toISOString(),
  status: "sent",
  raw: {
    telnyxMessageId,
    chatMessageId: payload.chatMessageId,
  },
};
```

**Fixed Code:**
```typescript
// message object is already loaded at line 28
const middlewarePayload = {
  eventType: "message.sent",
  messageId: telnyxMessageId,
  conversationId: message.chatId,  // ✅ ADD THIS - REQUIRED for GHL outbound messages
  direction: "outbound",
  from: payload.from,
  to: Array.isArray(payload.to) ? payload.to[0] : payload.to,
  body: payload.text || "",
  timestamp: new Date().toISOString(),
  status: "sent",
  raw: {
    telnyxMessageId,
    chatMessageId: payload.chatMessageId,
    chatId: message.chatId,  // ✅ ADD THIS TOO
  },
};
```

**Why This Matters:**
- When DF Middleware receives outbound webhook from Verity
- It needs to sync the message to GHL
- GHL's `/conversations/messages/outbound` endpoint **REQUIRES** `conversationId`
- Without it, the sync will fail with "No conversationId passed in body"

---

## Verification Checklist

### Verity Environment Variables ✅

- [ ] `DF_MIDDLEWARE_WEBHOOK_URL=https://df-middleware.vercel.app/api/webhooks/texting`
- [ ] `DF_MIDDLEWARE_WEBHOOK_SECRET=8e3d9345c580e8069f981a78663f9214f136e3082cbf75b7d388feebf38e8fac`
- [ ] `DF_MIDDLEWARE_API_KEY=622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c`

### DF Middleware Environment Variables ✅

- [ ] `VERITY_BASE_URL=https://verity.diversyfund.com`
- [ ] `VERITY_API_KEY=622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c`
- [ ] `VERITY_WEBHOOK_SECRET=8e3d9345c580e8069f981a78663f9214f136e3082cbf75b7d388feebf38e8fac`

### Code Fixes ⚠️

- [ ] Add `conversationId` to `sendSms` workflow webhook payload (CRITICAL)

### Testing ✅

- [ ] Test Verity endpoint: `curl https://verity.diversyfund.com/api/integrations/df-middleware/send-message` (should return 401, not 404)
- [ ] Test inbound message webhook forwarding
- [ ] Test outbound message webhook forwarding (with conversationId)

---

## Summary

1. **conversationId IS REQUIRED** - Must fix in Verity's `sendSms` workflow
2. **Three variables in Verity** - Set in Verity's environment (Doppler/Vercel)
3. **Three variables in DF Middleware** - Set in DF Middleware's Vercel environment
4. **GHL doesn't need Verity URL** - GHL only calls DF Middleware
5. **404 Error** - Likely `VERITY_BASE_URL` not set in DF Middleware, or endpoint not deployed

---

## Next Steps

1. ✅ Verify all 6 environment variables are set (3 in each system)
2. ✅ Fix `conversationId` in Verity's `sendSms` workflow
3. ✅ Test endpoint accessibility
4. ✅ Test full integration flow

