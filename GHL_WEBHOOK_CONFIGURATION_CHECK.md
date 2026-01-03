# GHL Webhook Configuration - Where to Check

## Understanding the Two Different Webhook Types

There are **two separate webhook configurations** in GHL:

### 1. Private Integrations Webhook (General)
- **Location:** Settings → Integrations → Private Integrations
- **Purpose:** General GHL webhooks (contacts, opportunities, etc.)
- **URL:** Usually something like `https://df-middleware.vercel.app/api/webhooks/ghl`
- **Status:** ✅ You mentioned this is already set

### 2. Marketplace App Provider Delivery URL (SMS Provider)
- **Location:** Marketplace App → Your App → Provider Settings
- **Purpose:** Receives outbound messages when agents send SMS through your provider
- **URL:** Should be `https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery`
- **Status:** ⚠️ This is what we need to verify

---

## Where to Check the Provider Delivery URL

### Step 1: Access Your Marketplace App

1. Go to GHL Dashboard
2. Navigate to: **Settings → Integrations → Marketplace Apps**
3. Find your custom SMS provider app (the one you created)
4. Click on it to open the app settings

### Step 2: Find Provider Configuration

In your Marketplace App settings, look for:

- **Provider Settings** or
- **SMS Provider Configuration** or
- **Delivery URL** or
- **Webhook URL** or
- **Provider Webhook**

### Step 3: Verify the Delivery URL

The Delivery URL should be set to:

```
https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery
```

**NOT:**
- ❌ `https://verity.diversyfund.com/...` (Verity URL)
- ❌ `https://df-middleware.vercel.app/api/webhooks/ghl` (General webhook endpoint)
- ❌ Any Verity-related URL

---

## Why GHL Doesn't Need Verity URL

**GHL never calls Verity directly.** The flow is:

```
Agent sends message in GHL
  ↓
GHL calls: https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery
  ↓
DF Middleware receives webhook
  ↓
DF Middleware calls: https://verity.diversyfund.com/api/integrations/df-middleware/send-message
  ↓
Verity sends via Telnyx
```

**GHL only knows about DF Middleware**, not Verity. That's why:
- ✅ Delivery URL = DF Middleware endpoint
- ❌ Delivery URL ≠ Verity endpoint

---

## What to Check

### ✅ Correct Configuration

**In GHL Marketplace App:**
- Delivery URL: `https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery`

**In DF Middleware (Vercel Environment Variables):**
- `VERITY_BASE_URL=https://verity.diversyfund.com` (This is where DF Middleware calls Verity)

**In Verity (Environment Variables):**
- `DF_MIDDLEWARE_WEBHOOK_URL=https://df-middleware.vercel.app/api/webhooks/texting` (Where Verity forwards webhooks TO DF Middleware)

### ❌ Incorrect Configuration

**If Delivery URL is set to Verity:**
- ❌ `https://verity.diversyfund.com/...`
- This would break the flow because GHL would try to call Verity directly, but Verity doesn't have the right endpoint for GHL's format

---

## How to Find Your Marketplace App

If you're not sure where your Marketplace App is:

1. **Check GHL Dashboard:**
   - Settings → Integrations → Marketplace Apps
   - Look for your custom SMS provider

2. **Check Provider ID:**
   - The `GHL_CONVERSATION_PROVIDER_ID` in your environment variables
   - This is the ID of your Marketplace App provider
   - You can search for it in GHL's Marketplace Apps list

3. **Check Provider Settings:**
   - Once you find the app, look for "Provider Settings" or "Configuration"
   - The Delivery URL should be in there

---

## Visual Guide

```
GHL Dashboard
├── Settings
    ├── Integrations
        ├── Private Integrations ← General webhook (already set ✅)
        └── Marketplace Apps
            └── [Your SMS Provider App] ← Provider Delivery URL (check here ⚠️)
                └── Provider Settings
                    └── Delivery URL: https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery
```

---

## Summary

1. **Private Integrations Webhook:** ✅ Already set (general GHL webhooks)
2. **Marketplace App Delivery URL:** ⚠️ Check this - should point to DF Middleware, NOT Verity
3. **Verity URL:** Only needed in DF Middleware's `VERITY_BASE_URL` environment variable

**The key point:** GHL's Delivery URL should point to **DF Middleware**, not Verity. DF Middleware then forwards to Verity internally.

---

## Quick Check

To verify everything is correct:

1. ✅ Check Marketplace App Delivery URL = `https://df-middleware.vercel.app/api/webhooks/ghl/provider-delivery`
2. ✅ Check DF Middleware `VERITY_BASE_URL` = `https://verity.diversyfund.com`
3. ✅ Check Verity `DF_MIDDLEWARE_WEBHOOK_URL` = `https://df-middleware.vercel.app/api/webhooks/texting`

If all three match, you're good! 🎉

