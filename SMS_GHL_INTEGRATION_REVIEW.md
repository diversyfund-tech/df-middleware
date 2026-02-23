# SMS & GHL Integration Review

**Date:** January 2025  
**Status:** ✅ Operational

---

## Executive Summary

This middleware implements a bidirectional SMS integration between **Verity** (proprietary texting system) and **GoHighLevel (GHL)**. The system handles both inbound and outbound messages, syncs them to GHL conversations, manages opt-outs, and enables agents to send messages from GHL that are forwarded through Verity to Telnyx.

---

## Architecture Overview

```
┌─────────┐         ┌──────────┐         ┌─────────────┐         ┌─────┐
│ Telnyx  │ ──────> │ Verity  │ ──────> │ DF         │ ──────> │ GHL │
│         │         │         │         │ Middleware │         │     │
└─────────┘         └──────────┘         └─────────────┘         └─────┘
                            ↑                      │
                            │                      │
                            └──────────────────────┘
                              (outbound messages)
```

### Key Components

1. **Verity** - Proprietary texting system that handles Telnyx integration
2. **DF Middleware** - Syncs messages between Verity and GHL
3. **GHL** - CRM platform with SMS conversation provider
4. **Telnyx** - SMS carrier (handled by Verity)

---

## Data Flow

### 1. Inbound Messages (Customer → Agent)

**Flow:**
```
Customer sends SMS
  ↓
Telnyx receives SMS
  ↓
Telnyx webhook → Verity
  ↓
Verity processes & forwards to DF Middleware
  ↓
DF Middleware webhook endpoint receives event
  ↓
Event stored in database (texting_webhook_events)
  ↓
Worker processes event
  ↓
Message synced to GHL conversation
```

**Implementation:**
- **Webhook Endpoint:** `POST /api/webhooks/texting`
- **Authentication:** `X-Texting-Secret` header
- **Processing:** Async via worker/job queue
- **Storage:** `texting_webhook_events` table with deduplication

**Key Files:**
- `src/app/api/webhooks/texting/route.ts` - Webhook receiver
- `src/lib/texting/router.ts` - Event router
- `src/lib/sync/texting-to-ghl.ts` - GHL sync logic
- `src/lib/texting/jobs.ts` - Job processor

---

### 2. Outbound Messages (Agent → Customer via GHL)

**Flow:**
```
Agent sends message in GHL
  ↓
GHL sends webhook to Provider Delivery URL
  ↓
DF Middleware receives at /api/webhooks/ghl/provider-delivery
  ↓
Middleware checks opt-out status
  ↓
Middleware forwards to Verity API
  ↓
Verity sends via Telnyx
  ↓
Delivery status updates come back through Verity → Middleware
```

**Implementation:**
- **Webhook Endpoint:** `POST /api/webhooks/ghl/provider-delivery`
- **GHL Configuration:** Delivery URL set in Marketplace App
- **Message Mapping:** Links GHL message ID to Verity message ID

**Key Files:**
- `src/app/api/webhooks/ghl/provider-delivery/route.ts` - Provider delivery handler
- `src/lib/texting/client.ts` - Verity API client

---

### 3. Outbound Messages (System → Customer)

**Flow:**
```
System calls sendMessage()
  ↓
Checks opt-out registry
  ↓
Sends to Verity API
  ↓
Verity sends via Telnyx
  ↓
Verity webhook confirms message sent
  ↓
Message synced to GHL
```

**Implementation:**
- **Function:** `sendMessage()` in `src/lib/texting/client.ts`
- **Opt-out Check:** Before sending, checks `optout_registry` table
- **Error Handling:** Throws `OptedOutError` if number opted out

---

## Key Features

### 1. Opt-Out Management

**STOP Keyword Detection:**
- Keywords: `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`, `OPT-OUT`, `OPTOUT`
- Detection: Case-insensitive, handles variations
- Action: 
  - Adds to `optout_registry` table
  - Tags GHL contact with `DNC-SMS` and `SMS Opted Out`
  - Prevents future messages

**Implementation:**
- `src/lib/compliance/smsOptOut.ts` - Opt-out detection
- `src/lib/sync/texting-to-ghl.ts` - STOP handling in sync

### 2. Contact Management

**Contact Creation:**
- Auto-creates GHL contacts for texting-only conversations
- Uses phone number as primary identifier
- Stores mapping in `contact_mappings` table

**Contact Mapping:**
- Links Verity contacts to GHL contacts
- Supports texting-only contacts (no Aloware contact)
- Bidirectional sync support

### 3. Message Mapping

**Message Tracking:**
- Maps Verity message IDs to GHL message IDs
- Stores in `message_mappings` table
- Enables status tracking and deduplication

**Database Schema:**
```sql
message_mappings:
  - texting_message_id (Verity)
  - ghl_message_id (GHL)
  - conversation_id
  - ghl_contact_id
  - from_number / to_number
  - direction (inbound/outbound)
```

### 4. Deduplication

**Webhook Deduplication:**
- Uses `dedupeKey` based on event type, entity ID, and timestamp
- SHA-256 hash prevents duplicate processing
- Database unique constraint enforces deduplication

**Implementation:**
- `src/app/api/webhooks/texting/route.ts` - Dedupe key generation
- `texting_webhook_events.dedupeKey` - Unique constraint

### 5. Error Handling & Retries

**Job Processing:**
- Events stored with `pending` status
- Worker processes events asynchronously
- Status transitions: `pending` → `processing` → `done` / `error`
- Retry logic via pg-boss job queue

**Error Logging:**
- All sync operations logged to `sync_log` table
- Error messages stored for debugging
- Quarantine support for problematic events

---

## GHL Integration Details

### Marketplace App Configuration

**Provider Type:** Custom SMS Conversation Provider  
**Provider ID:** Stored in `GHL_CONVERSATION_PROVIDER_ID` env var  
**Delivery URL:** `https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery`

### OAuth Authentication

**Token Management:**
- OAuth tokens stored in `ghl_oauth_tokens` table
- Automatic token refresh
- Used for provider-related API calls

**Implementation:**
- `src/lib/ghl/oauth-tokens.ts` - Token management
- `src/lib/ghl/client.ts` - OAuth-aware request handler

### Conversation Management

**Auto-Creation:**
- GHL auto-creates conversations when messages are added
- Uses `contactId` + `conversationProviderId`
- One conversation per contact per provider

**Endpoints Used:**
- `POST /conversations/messages/inbound` - Inbound messages
- `POST /conversations/messages/outbound` - Outbound messages
- `POST /conversations` - Conversation creation (if needed)

**Implementation:**
- `src/lib/ghl/conversations.ts` - GHL conversation API

---

## Database Schema

### Core Tables

**texting_webhook_events**
- Stores incoming webhook events from Verity
- Status: `pending`, `processing`, `done`, `error`
- Deduplication via `dedupeKey`

**message_mappings**
- Maps messages across systems
- Links Verity → GHL message IDs
- Tracks conversation and contact relationships

**contact_mappings**
- Maps contacts across systems
- Links phone numbers to GHL/Aloware contacts
- Supports texting-only contacts

**optout_registry**
- Tracks SMS opt-outs
- Status: `opted_out`, `opted_in`
- Source tracking: `texting`, `ghl`, `manual`

**sync_log**
- Logs all sync operations
- Tracks success/failure
- Error messages for debugging

---

## Environment Variables

### Required

```bash
# Verity Integration
VERITY_BASE_URL=https://verity.vercel.app
VERITY_API_KEY=<api-key>
VERITY_WEBHOOK_SECRET=<webhook-secret>

# GHL Configuration
GHL_LOCATION_ID=<location-id>
GHL_CONVERSATION_PROVIDER_ID=<provider-id>
GHL_API_KEY=<api-key>  # Fallback, OAuth preferred

# Optional
TEXTING_SYNC_TO_ALOWARE=false  # Enable Aloware sync
```

---

## API Endpoints

### Inbound Webhooks

**POST /api/webhooks/texting**
- Receives webhooks from Verity
- Validates `X-Texting-Secret` header
- Stores events in database
- Returns 200 immediately (async processing)

**POST /api/webhooks/ghl/provider-delivery**
- Receives provider webhooks from GHL
- Forwards messages to Verity
- Stores message mappings
- Returns Verity message ID to GHL

### Job Processing

**GET /api/jobs/process-pending**
- Processes pending webhook events
- Called by Vercel Cron or worker
- Processes events in batches

---

## Message Sync Logic

### Inbound Message Sync

**Process:**
1. Receive webhook from Verity
2. Normalize payload
3. Check for STOP keyword
4. Find/create contact mapping
5. Add message to GHL conversation
6. Store message mapping
7. Log sync operation

**Key Function:** `syncTextingMessageToGHL()` in `src/lib/sync/texting-to-ghl.ts`

### Outbound Message Sync

**Process:**
1. Receive provider webhook from GHL
2. Extract message details
3. Check opt-out status
4. Send via Verity API
5. Store message mapping
6. Return Verity message ID to GHL

**Key Function:** Provider delivery handler in `src/app/api/webhooks/ghl/provider-delivery/route.ts`

---

## Normalization

**Purpose:** Handle various webhook formats generically

**Supported Formats:**
- Verity normalized format
- Telnyx format (via Verity)
- Generic provider formats

**Implementation:**
- `src/lib/texting/normalize.ts` - Normalization logic
- Extracts: eventType, messageId, direction, from/to, body, timestamp, status

---

## Status Tracking

**Message Statuses:**
- `queued` - Message queued for sending
- `sent` - Message sent successfully
- `delivered` - Message delivered to recipient
- `failed` - Message failed to send
- `received` - Inbound message received

**Event Types:**
- `message.received` - Inbound message
- `message.sent` - Outbound message sent
- `message.delivered` - Delivery confirmation
- `message.failed` - Send failure
- `optout.stop` - Opt-out request

---

## Error Handling

### Opt-Out Errors

**OptedOutError:**
- Thrown when attempting to send to opted-out number
- Prevents message sending
- Logged for monitoring

### API Errors

**Verity API Errors:**
- Network errors
- Authentication errors
- Rate limiting
- Invalid payloads

**GHL API Errors:**
- OAuth token issues
- Provider validation errors
- Contact/conversation errors

### Retry Logic

**Job Queue:**
- pg-boss handles retries
- Exponential backoff
- Max retry attempts

---

## Testing

### Test Inbound Message

1. Send SMS to Verity phone number
2. Check `texting_webhook_events` table
3. Verify event processed
4. Check GHL conversation for message

### Test Outbound Message

1. Send message from GHL
2. Check provider delivery webhook received
3. Verify message sent via Verity
4. Check message mapping stored

### Test Opt-Out

1. Send "STOP" message
2. Verify opt-out registry updated
3. Verify GHL contact tagged
4. Attempt to send message (should fail)

---

## Known Issues & Limitations

### Historical Message Import

**Status:** ⚠️ Blocked on GHL API validation
- Provider validation errors when importing historical messages
- See `GHL_MESSAGE_IMPORT_DEBUG_REPORT.md` for details

### Provider Configuration

**Requirement:** Marketplace App with custom SMS provider
- Provider ID must be configured
- OAuth tokens required for provider calls
- Delivery URL must be set in GHL

---

## Future Improvements

1. **Status Updates:** Sync delivery status back to GHL
2. **Media Support:** Handle MMS/media messages
3. **Conversation Threading:** Better conversation management
4. **Rate Limiting:** Implement rate limiting for GHL API calls
5. **Webhook Retries:** Retry failed webhook deliveries

---

## Related Documentation

- `VERITY_INTEGRATION.md` - Verity integration details
- `GHL_PROVIDER_DELIVERY.md` - Provider delivery webhook
- `GHL_MESSAGE_IMPORT_DEBUG_REPORT.md` - Historical import issues
- `EVENTS_AND_DATA_FLOW.md` - Overall event flow

---

## Summary

The SMS integration is **fully operational** for:
- ✅ Inbound messages (Customer → Agent)
- ✅ Outbound messages (Agent → Customer via GHL)
- ✅ Opt-out management
- ✅ Contact creation and mapping
- ✅ Message deduplication
- ✅ Error handling and logging

**Blocked on:**
- ⚠️ Historical message import (GHL API validation)

The system provides a robust, bidirectional SMS integration between Verity and GHL with comprehensive error handling, opt-out management, and message tracking.



