# Verity Integration Documentation

**Date:** December 26, 2024  
**Status:** ✅ Complete

---

## Overview

The DF Middleware now integrates with **Verity** (the proprietary texting system) instead of connecting directly to Telnyx. Verity acts as the abstraction layer, handling all Telnyx integration, business logic, retries, and rate limiting.

## Architecture

```
Telnyx → Verity → DF Middleware → GHL/Aloware
                ↑
                └─── Middleware sends messages via Verity API
```

### Data Flow

1. **Inbound Messages:**
   - Telnyx sends webhook to Verity
   - Verity processes message (handlesInboundSms workflow)
   - Verity forwards normalized webhook to DF Middleware
   - DF Middleware syncs message to GHL/Aloware

2. **Outbound Messages:**
   - DF Middleware calls Verity API to send message
   - Verity sends message via Telnyx (sendSms workflow)
   - Verity forwards delivery status to DF Middleware
   - DF Middleware syncs status to GHL/Aloware

---

## Verity Endpoints Created

### 1. Webhook Forwarding Endpoint

**Path:** `POST /api/integrations/df-middleware/webhook`

**Purpose:** Forward Telnyx webhooks to DF Middleware

**Flow:**
- Receives Telnyx webhook payload from Verity's internal processing
- Normalizes Telnyx event format to middleware format
- Forwards to DF Middleware webhook endpoint
- Includes `X-Texting-Secret` header for authentication

**Normalized Event Types:**
- `message.received` - Inbound messages
- `message.sent` - Outbound messages (finalized/sending)
- `message.delivered` - Delivery confirmations
- `message.failed` - Failed messages

**File:** `/Users/jaredlutz/Github/verity/src/app/api/integrations/df-middleware/webhook/route.ts`

---

### 2. Send Message API Endpoint

**Path:** `POST /api/integrations/df-middleware/send-message`

**Purpose:** Allow DF Middleware to send messages via Verity

**Authentication:** Bearer token (`DF_MIDDLEWARE_API_KEY`)

**Request Body:**
```json
{
  "to": "+1234567890",           // E.164 phone number (required)
  "from": "+1234567890",         // E.164 phone number (optional, uses system default)
  "body": "Message text",        // Message content (required)
  "conversationId": "uuid",       // Optional conversation ID
  "correlationId": "uuid"        // Optional correlation ID for loop prevention
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "uuid",
  "chatId": "uuid",
  "status": "pending"
}
```

**File:** `/Users/jaredlutz/Github/verity/src/app/api/integrations/df-middleware/send-message/route.ts`

---

## Verity Workflow Updates

### handleInboundSms Workflow

**File:** `/Users/jaredlutz/Github/verity/src/lib/comms/workflows/handleInboundSms.ts`

**Changes:**
- Added webhook forwarding to DF Middleware after processing inbound message
- Forwards normalized payload with `message.received` event type
- Non-blocking (errors don't fail the workflow)

### sendSms Workflow

**File:** `/Users/jaredlutz/Github/verity/src/lib/comms/workflows/sendSms.ts`

**Changes:**
- Added webhook forwarding to DF Middleware after successful send
- Forwards normalized payload with `message.sent` event type
- Non-blocking (errors don't fail the workflow)

---

## DF Middleware Updates

### Texting Client

**File:** `/Users/jaredlutz/Github/df-middleware/src/lib/texting/client.ts`

**Changes:**
- Updated to use `VERITY_BASE_URL` and `VERITY_API_KEY` instead of `TEXTING_BASE_URL`/`TEXTING_API_KEY`
- `sendMessage()` now calls Verity's `/api/integrations/df-middleware/send-message` endpoint
- Uses Bearer token authentication
- Still checks opt-out registry before sending

### Webhook Handler

**File:** `/Users/jaredlutz/Github/df-middleware/src/app/api/webhooks/texting/route.ts`

**Changes:**
- Updated to use `VERITY_WEBHOOK_SECRET` instead of `TEXTING_WEBHOOK_SECRET`
- Receives normalized webhooks from Verity
- Existing normalization logic still works (handles Verity's normalized format)

---

## Environment Variables

### Verity Environment Variables

Add to Verity's `.env` or Doppler:

```bash
# DF Middleware Integration
DF_MIDDLEWARE_WEBHOOK_URL=https://df-middleware.vercel.app/api/webhooks/texting
DF_MIDDLEWARE_WEBHOOK_SECRET=<generate-secure-secret>
DF_MIDDLEWARE_API_KEY=<generate-secure-api-key>
```

**File:** `/Users/jaredlutz/Github/verity/env.mjs` (already updated)

---

### DF Middleware Environment Variables

Update `.env.local`:

```bash
# Texting System Configuration (Verity Integration)
VERITY_BASE_URL=https://verity.vercel.app  # Verity API base URL
VERITY_API_KEY=<api-key-from-verity>       # API key for Verity authentication
VERITY_WEBHOOK_SECRET=<webhook-secret>     # Secret for Verity webhook authentication
TEXTING_SYNC_TO_ALOWARE=false              # Optional: Enable Aloware sync
```

**File:** `/Users/jaredlutz/Github/df-middleware/.env.local` (already updated)  
**File:** `/Users/jaredlutz/Github/df-middleware/env.mjs` (already updated)

---

## Setup Instructions

### 1. Generate Secrets

Generate secure secrets for both systems:

```bash
# Generate webhook secret (use same value in both systems)
openssl rand -hex 32

# Generate API key for Verity
openssl rand -hex 32
```

### 2. Configure Verity

Add to Verity's environment (Doppler or `.env.local`):

```bash
DF_MIDDLEWARE_WEBHOOK_URL=https://df-middleware.vercel.app/api/webhooks/texting
DF_MIDDLEWARE_WEBHOOK_SECRET=<generated-secret>
DF_MIDDLEWARE_API_KEY=<generated-api-key>
```

### 3. Configure DF Middleware

Add to DF Middleware's `.env.local`:

```bash
VERITY_BASE_URL=https://verity.vercel.app
VERITY_API_KEY=<same-api-key-as-above>
VERITY_WEBHOOK_SECRET=<same-webhook-secret-as-above>
```

### 4. Deploy Both Systems

Deploy both Verity and DF Middleware with updated environment variables.

---

## Testing

### Test Webhook Forwarding

1. Send a test SMS to a Verity phone number
2. Check Verity logs for webhook forwarding
3. Check DF Middleware logs for received webhook
4. Verify message appears in `texting_webhook_events` table

### Test Send Message API

```bash
curl -X POST https://verity.vercel.app/api/integrations/df-middleware/send-message \
  -H "Authorization: Bearer <VERITY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "body": "Test message from middleware"
  }'
```

Expected response:
```json
{
  "success": true,
  "messageId": "uuid",
  "chatId": "uuid",
  "status": "pending"
}
```

---

## Benefits of This Architecture

1. **Provider Abstraction:** Middleware doesn't need to know about Telnyx
2. **Business Logic:** Verity handles retries, rate limiting, opt-outs
3. **Consistency:** Single source of truth for messaging logic
4. **Flexibility:** Easy to switch providers (only Verity changes)
5. **Error Handling:** Verity's robust error handling benefits middleware

---

## Troubleshooting

### Webhooks Not Forwarding

- Check `DF_MIDDLEWARE_WEBHOOK_URL` is set correctly in Verity
- Verify `VERITY_WEBHOOK_SECRET` matches in both systems
- Check Verity logs for forwarding errors
- Verify DF Middleware webhook endpoint is accessible

### Send Message API Failing

- Verify `VERITY_API_KEY` matches `DF_MIDDLEWARE_API_KEY` in Verity
- Check `VERITY_BASE_URL` is correct
- Verify Verity endpoint is accessible
- Check Verity logs for authentication errors

### Messages Not Syncing

- Verify webhooks are being received by DF Middleware
- Check `texting_webhook_events` table for pending events
- Run worker process: `pnpm run worker`
- Check `sync_log` table for errors

---

**Integration Complete!** ✅

Both systems are now configured to work together. Verity handles all Telnyx integration, and DF Middleware focuses on syncing messages to GHL and Aloware.

