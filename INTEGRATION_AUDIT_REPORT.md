# DF Middleware ↔ Verity Integration Audit Report

**Date:** January 27, 2025  
**Status:** ⚠️ **Issues Found** - See recommendations below

---

## Executive Summary

The integration between DF Middleware and Verity is **mostly correct** but has several configuration inconsistencies and potential issues:

1. ✅ **Webhook forwarding** - Correctly implemented in workflows
2. ⚠️ **Environment variable usage** - Workflows use `process.env` instead of validated `env` object
3. ✅ **API endpoint paths** - Correctly configured
4. ⚠️ **Payload format** - Minor inconsistencies in conversationId handling
5. ✅ **Authentication** - Properly configured with shared secrets
6. ⚠️ **Missing webhook endpoint** - Verity has `/api/integrations/df-middleware/webhook` but workflows call directly

---

## Integration Points

### 1. Verity → DF Middleware (Webhook Forwarding)

#### Current Implementation

**Two Methods:**

1. **Direct from Workflows** (Currently Used):
   - `handleInboundSms.ts` - Forwards inbound messages directly
   - `sendSms.ts` - Forwards outbound messages directly
   - Uses `process.env.DF_MIDDLEWARE_WEBHOOK_URL` directly
   - Sends to: `https://df-middleware.vercel.app/api/webhooks/texting`

2. **Via Webhook Endpoint** (Exists but Not Used):
   - `/api/integrations/df-middleware/webhook/route.ts` - Normalizes Telnyx webhooks
   - Currently not called by workflows

#### Issues Found

1. **⚠️ Environment Variable Access**
   - **Location:** `handleInboundSms.ts:273`, `sendSms.ts:175`
   - **Issue:** Uses `process.env.DF_MIDDLEWARE_WEBHOOK_URL` instead of validated `env` object
   - **Impact:** No type safety, no validation, could fail silently if misconfigured
   - **Recommendation:** Use `env.DF_MIDDLEWARE_WEBHOOK_URL` from `@/env`

2. **⚠️ Inconsistent Webhook Path**
   - **Current:** Workflows call DF Middleware webhook directly
   - **Alternative:** Could use `/api/integrations/df-middleware/webhook` endpoint for normalization
   - **Status:** Current approach works, but endpoint exists unused

3. **✅ Payload Format** - Correct
   - Includes `conversationId` for outbound messages ✅
   - Includes `messageId` (Telnyx ID) ✅
   - Includes `direction`, `from`, `to`, `body`, `timestamp` ✅

#### Verification

**Verity Environment Variables Required:**
```bash
DF_MIDDLEWARE_WEBHOOK_URL=https://df-middleware.vercel.app/api/webhooks/texting
DF_MIDDLEWARE_WEBHOOK_SECRET=<shared-secret>
```

**DF Middleware Environment Variables Required:**
```bash
VERITY_WEBHOOK_SECRET=<same-shared-secret>
```

**Status:** ✅ Correctly configured (assuming secrets match)

---

### 2. DF Middleware → Verity (API Calls)

#### Current Implementation

**Endpoint:** `POST /api/integrations/df-middleware/send-message`

**Called From:**
- `src/lib/texting/client.ts` - `sendMessage()` function
- `src/app/api/webhooks/ghl/provider-delivery/route.ts` - GHL provider delivery handler

#### Issues Found

1. **✅ API Path** - Correct
   - DF Middleware calls: `${VERITY_BASE_URL}/api/integrations/df-middleware/send-message`
   - Verity endpoint exists at: `/api/integrations/df-middleware/send-message/route.ts`

2. **✅ Authentication** - Correct
   - DF Middleware sends: `Authorization: Bearer ${VERITY_API_KEY}`
   - Verity validates: `env.DF_MIDDLEWARE_API_KEY`
   - **Must match:** `VERITY_API_KEY` (DF Middleware) = `DF_MIDDLEWARE_API_KEY` (Verity)

3. **⚠️ Response Format** - Minor Issue
   - **Verity Returns:** `{ success: true, messageId: <verity-id>, chatId: <uuid>, status: "pending" }`
   - **DF Middleware Expects:** `{ messageId?: string; id?: string; success?: boolean }`
   - **Status:** ✅ Compatible (handles both `messageId` and `id`)

4. **✅ Payload Format** - Correct
   - Includes `to`, `body`, `from` (optional), `conversationId` (optional), `correlationId` (optional)
   - Matches Verity's `SendMessageSchema` ✅

#### Verification

**DF Middleware Environment Variables Required:**
```bash
VERITY_BASE_URL=https://verity.diversyfund.com
VERITY_API_KEY=<shared-api-key>
```

**Verity Environment Variables Required:**
```bash
DF_MIDDLEWARE_API_KEY=<same-shared-api-key>
```

**Status:** ✅ Correctly configured (assuming API keys match)

---

## Environment Variable Audit

### Verity Environment Variables

**Required for Integration:**
```bash
# Webhook forwarding (Verity → DF Middleware)
DF_MIDDLEWARE_WEBHOOK_URL=https://df-middleware.vercel.app/api/webhooks/texting
DF_MIDDLEWARE_WEBHOOK_SECRET=<shared-secret>

# API authentication (DF Middleware → Verity)
DF_MIDDLEWARE_API_KEY=<shared-api-key>

# Optional: Broadcast analytics sync
DF_MIDDLEWARE_BASE_URL=https://df-middleware.vercel.app
BROADCAST_ANALYTICS_SYNC_VIA_MIDDLEWARE=false
```

**Status:** ✅ Defined in `env.mjs` schema (all optional, which is correct)

### DF Middleware Environment Variables

**Required for Integration:**
```bash
# API calls (DF Middleware → Verity)
VERITY_BASE_URL=https://verity.diversyfund.com
VERITY_API_KEY=<shared-api-key>

# Webhook authentication (Verity → DF Middleware)
VERITY_WEBHOOK_SECRET=<shared-secret>

# Optional: Verity database access
VERITY_DATABASE_URL=<neon-connection-string>
```

**Status:** ✅ Defined in `env.mjs` schema (all optional, which is correct)

---

## Payload Format Compatibility

### Inbound Messages (Verity → DF Middleware)

**Verity Sends:**
```json
{
  "eventType": "message.received",
  "messageId": "<telnyx-message-id>",
  "conversationId": "<chat-id>",
  "direction": "inbound",
  "from": "+1234567890",
  "to": "+0987654321",
  "body": "Message text",
  "timestamp": "2025-01-27T12:00:00Z",
  "status": "received",
  "raw": { ... }
}
```

**DF Middleware Receives:**
- Endpoint: `/api/webhooks/texting`
- Validates: `X-Texting-Secret` header
- Normalizes: Uses `normalizeTextingWebhook()` which handles this format ✅

**Status:** ✅ Compatible

### Outbound Messages (Verity → DF Middleware)

**Verity Sends:**
```json
{
  "eventType": "message.sent",
  "messageId": "<telnyx-message-id>",
  "conversationId": "<chat-id>",  // ✅ Included for GHL
  "direction": "outbound",
  "from": "+1234567890",
  "to": "+0987654321",
  "body": "Message text",
  "timestamp": "2025-01-27T12:00:00Z",
  "status": "sent",
  "raw": { ... }
}
```

**Status:** ✅ Compatible (conversationId included)

### Send Message Request (DF Middleware → Verity)

**DF Middleware Sends:**
```json
{
  "to": "+1234567890",
  "from": "+0987654321",  // optional
  "body": "Message text",
  "conversationId": "<uuid>",  // optional
  "correlationId": "<uuid>"    // optional
}
```

**Verity Receives:**
- Endpoint: `/api/integrations/df-middleware/send-message`
- Validates: `Authorization: Bearer <DF_MIDDLEWARE_API_KEY>`
- Schema: Matches `SendMessageSchema` ✅

**Status:** ✅ Compatible

---

## Critical Issues & Recommendations

### 🔴 High Priority

1. **Environment Variable Access in Workflows**
   - **Issue:** `handleInboundSms.ts` and `sendSms.ts` use `process.env` directly
   - **Risk:** No validation, could fail silently if misconfigured
   - **Fix:** Import `env` from `@/env` and use `env.DF_MIDDLEWARE_WEBHOOK_URL`
   - **Files:**
     - `/Users/jaredlutz/Github/verity/src/lib/comms/workflows/handleInboundSms.ts:273`
     - `/Users/jaredlutz/Github/verity/src/lib/comms/workflows/sendSms.ts:175`

### 🟡 Medium Priority

2. **Unused Webhook Normalization Endpoint**
   - **Issue:** `/api/integrations/df-middleware/webhook/route.ts` exists but workflows don't use it
   - **Impact:** Code duplication, workflows normalize payloads directly
   - **Recommendation:** Either:
     - Use the endpoint for normalization (better separation of concerns)
     - OR remove the endpoint if workflows handle normalization directly
   - **Status:** Current approach works, but could be cleaner

3. **Missing conversationId Validation**
   - **Issue:** Verity's send endpoint accepts optional `conversationId`, but GHL requires it for outbound messages
   - **Impact:** Could cause GHL sync failures if conversationId missing
   - **Status:** Currently handled gracefully (optional), but could add validation

### 🟢 Low Priority

4. **Response Format Handling**
   - **Issue:** DF Middleware handles both `messageId` and `id` in response
   - **Status:** ✅ Works, but could standardize on `messageId`

5. **Error Handling**
   - **Status:** ✅ Good - Non-blocking in workflows, proper error responses in API

---

## Configuration Checklist

### Verity Environment Variables
- [ ] `DF_MIDDLEWARE_WEBHOOK_URL` set to `https://df-middleware.vercel.app/api/webhooks/texting`
- [ ] `DF_MIDDLEWARE_WEBHOOK_SECRET` matches `VERITY_WEBHOOK_SECRET` in DF Middleware
- [ ] `DF_MIDDLEWARE_API_KEY` matches `VERITY_API_KEY` in DF Middleware
- [ ] `DF_MIDDLEWARE_BASE_URL` set (optional, for broadcast analytics)

### DF Middleware Environment Variables
- [ ] `VERITY_BASE_URL` set to `https://verity.diversyfund.com`
- [ ] `VERITY_API_KEY` matches `DF_MIDDLEWARE_API_KEY` in Verity
- [ ] `VERITY_WEBHOOK_SECRET` matches `DF_MIDDLEWARE_WEBHOOK_SECRET` in Verity
- [ ] `VERITY_DATABASE_URL` set (optional, for direct database access)

---

## Testing Recommendations

1. **Test Inbound Message Flow:**
   ```bash
   # Send test message via Telnyx → Verity → DF Middleware
   # Verify message appears in GHL conversation
   ```

2. **Test Outbound Message Flow:**
   ```bash
   # Send message from GHL → DF Middleware → Verity → Telnyx
   # Verify message sent successfully
   ```

3. **Test Authentication:**
   ```bash
   # Verify webhook secret validation
   # Verify API key validation
   ```

4. **Test Error Handling:**
   ```bash
   # Test with missing environment variables
   # Test with invalid secrets/keys
   # Verify non-blocking behavior in workflows
   ```

---

## Summary

**Overall Status:** ✅ **Integration is functional** with minor improvements recommended

**Key Findings:**
- ✅ Webhook forwarding works correctly
- ✅ API calls work correctly
- ✅ Authentication properly configured
- ⚠️ Environment variable access could be improved
- ⚠️ Unused endpoint could be cleaned up

**Action Items:**
1. Update workflows to use `env` object instead of `process.env`
2. Decide on webhook normalization endpoint usage
3. Verify environment variables match in production
4. Test end-to-end message flows

---

**Report Generated:** January 27, 2025  
**Next Review:** After implementing recommendations
