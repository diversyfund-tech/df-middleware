# GHL Webhook Endpoints - Explanation

**Date:** January 27, 2025

---

## Two Different Endpoints for Different Purposes

You have **two separate webhook endpoints** configured in GHL, and they serve completely different purposes:

### 1. General GHL Webhook (`/api/webhooks/ghl`)

**URL:** `https://df-middleware.vercel.app/api/webhooks/ghl`  
**Location in GHL:** Settings → Integrations → Private Integrations → Automation  
**Purpose:** General CRM sync (GHL → Aloware)

**What It Handles:**
- ✅ Contact events (`contact.created`, `contact.updated`, `contact.deleted`)
- ✅ Tag/segment events (syncs tags to Aloware call lists)
- ✅ Pipeline/opportunity events (for agent-managed lists)
- ✅ Appointment events (stored but not synced)

**What It Does:**
- Receives general GHL webhooks
- Stores events in `webhook_events` table
- Routes to sync handlers (GHL → Aloware direction)
- Syncs contacts, tags, and list memberships to Aloware

**Status:** ✅ **Correctly configured** - This is needed for CRM sync

**Verity Connection:** ❌ **None** - Verity doesn't need to know about this endpoint

---

### 2. SMS Provider Delivery Webhook (`/api/webhooks/ghl/provider-delivery`)

**URL:** `https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery`  
**Location in GHL:** Marketplace App → Provider Settings → Delivery URL  
**Purpose:** SMS provider integration (GHL → DF Middleware → Verity)

**What It Handles:**
- ✅ Outbound SMS messages (when agents send messages)
- ✅ Message delivery status updates

**What It Does:**
- Receives outbound SMS webhooks from GHL
- Forwards messages to Verity API (`/api/integrations/df-middleware/send-message`)
- Stores message mappings (GHL message ID ↔ Verity message ID)
- Handles opt-out checking before sending

**Status:** ✅ **Correctly configured** - This is needed for SMS integration

**Verity Connection:** ✅ **Yes** - DF Middleware calls Verity's API when receiving webhooks here

---

## Summary

| Endpoint | Purpose | GHL Location | Verity Connection |
|----------|---------|--------------|-------------------|
| `/api/webhooks/ghl` | General CRM sync | Private Integrations | ❌ None |
| `/api/webhooks/ghl/provider-delivery` | SMS provider | Marketplace App | ✅ Yes |

---

## Do You Need Both?

### ✅ Yes, Keep Both

1. **General Webhook (`/api/webhooks/ghl`):**
   - Needed for: Contact sync, tag sync, list management
   - Used for: GHL → Aloware CRM synchronization
   - **Keep it** - It's working correctly

2. **Provider Delivery (`/api/webhooks/ghl/provider-delivery`):**
   - Needed for: SMS messaging integration
   - Used for: Agent → Verity → Telnyx message flow
   - **Keep it** - Required for SMS functionality

---

## Should Anything Be Changed?

### ✅ No Changes Needed

Both endpoints are correctly configured:

1. **General Webhook:** ✅ Correct URL, correct purpose
2. **Provider Delivery:** ✅ Correct URL, correct purpose

### ⚠️ Only One Thing to Verify

Make sure the **Provider Delivery URL** in your Marketplace App is set to:
```
https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery
```

**NOT:**
- ❌ `https://df-middleware.vercel.app/api/webhooks/ghl` (general webhook)
- ❌ Any Verity URL

---

## Verity Configuration

**Verity does NOT need to know about:**
- ❌ The general GHL webhook (`/api/webhooks/ghl`)
- ❌ GHL's Private Integrations configuration

**Verity only needs:**
- ✅ `DF_MIDDLEWARE_WEBHOOK_URL` = `https://df-middleware.vercel.app/api/webhooks/texting`
  - This is where Verity forwards SMS webhooks TO DF Middleware
- ✅ `DF_MIDDLEWARE_API_KEY` = (shared secret)
- ✅ `DF_MIDDLEWARE_WEBHOOK_SECRET` = (shared secret)

**Verity's role:**
- Receives SMS from Telnyx
- Forwards webhooks to DF Middleware (`/api/webhooks/texting`)
- Receives API calls from DF Middleware (`/api/integrations/df-middleware/send-message`)

---

## Data Flow Summary

### General CRM Sync (Not SMS-Related)
```
GHL Contact/Tag Event
  ↓
GHL → /api/webhooks/ghl (Private Integrations)
  ↓
DF Middleware processes event
  ↓
Syncs to Aloware (if needed)
```

### SMS Flow (Provider Delivery)
```
GHL Agent sends SMS
  ↓
GHL → /api/webhooks/ghl/provider-delivery (Marketplace App)
  ↓
DF Middleware receives webhook
  ↓
DF Middleware → Verity API (/api/integrations/df-middleware/send-message)
  ↓
Verity → Telnyx
  ↓
Message sent
```

### Inbound SMS Flow (Verity → GHL)
```
Telnyx receives SMS
  ↓
Telnyx → Verity
  ↓
Verity → DF Middleware (/api/webhooks/texting)
  ↓
DF Middleware → GHL API (adds message to conversation)
```

---

## Conclusion

✅ **Both endpoints are correctly configured**  
✅ **No changes needed**  
✅ **Verity doesn't need to know about the general webhook**

The only thing to verify is that your Marketplace App's Delivery URL is set to `/api/webhooks/ghl/provider-delivery` (which you confirmed it is).

---

## Quick Reference

**General GHL Webhook:**
- Endpoint: `/api/webhooks/ghl`
- Purpose: CRM sync (contacts, tags, lists)
- GHL Location: Private Integrations
- Verity Connection: None

**SMS Provider Delivery:**
- Endpoint: `/api/webhooks/ghl/provider-delivery`
- Purpose: SMS messaging
- GHL Location: Marketplace App → Provider Settings
- Verity Connection: Yes (DF Middleware calls Verity API)

