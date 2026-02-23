# Sync Issues Diagnosis Report

**Date:** January 27, 2025  
**Issues Reported:**
1. Broadcast cadence messages not syncing to middleware
2. New tags not being added/synced

---

## 🔴 Critical Issues Found

### 1. Events Not Being Processed (42,430 pending events)

**Status:** 🔴 **CRITICAL**

- **42,430 `contact.updated` events** stuck in `pending` status
- **565 `ConversationUnreadUpdate` events** pending
- **527 `InboundMessage` events** pending
- **Oldest pending event:** December 29, 2025
- **Newest pending event:** January 12, 2026 (today)

**Root Cause:**
- Vercel Cron job (`/api/jobs/process-pending`) should run every 5 minutes
- Events are being received but not processed
- This is why tags aren't syncing - the events are queued but never executed

**Impact:**
- Tag changes aren't syncing to Aloware lists
- Contact updates aren't being processed
- Agent list sync isn't working

**Fix Required:**
1. Manually trigger event processing to clear backlog
2. Verify cron job is running
3. Check for errors preventing processing

---

### 2. Broadcast Messages Not Forwarding

**Status:** ⚠️ **WARNING**

- **0 texting webhook events** in last 24 hours
- Verity has `BROADCAST_ANALYTICS_SYNC_VIA_MIDDLEWARE=true`
- But actual SMS messages aren't being forwarded

**Root Cause:**
- `BROADCAST_ANALYTICS_SYNC_VIA_MIDDLEWARE` only syncs **analytics**, not messages
- Verity workflows (`handleInboundSms`, `sendSms`) should forward messages but aren't
- Messages from broadcast cadences go through different code path

**Impact:**
- Broadcast SMS messages aren't syncing to GHL
- Messages sent via cadences aren't tracked in middleware

**Fix Required:**
1. Check if Verity workflows are calling middleware webhook
2. Verify `DF_MIDDLEWARE_WEBHOOK_URL` is being used in broadcast message sending
3. Check Verity logs for webhook forwarding errors

---

### 3. Tag Sync Logic (Actually Works!)

**Status:** ✅ **Code is correct, but blocked by issue #1**

The middleware DOES handle tag changes from `contact.updated` events:

```typescript
// In resolveListIntent.ts (lines 133-149)
if (eventType === "contact.changed" || eventType === "contact.updated") {
    if (contact?.tags && Array.isArray(contact.tags)) {
        // Maps tags to list keys (CALL_NOW, HOT, FOLLOW_UP, etc.)
        for (const tag of contact.tags) {
            if (tagMatches(tag, "CALL_NOW", tagMatchMode)) {
                add.push("CALL_NOW");
            }
            // ... etc
        }
    }
}
```

**Why it's not working:**
- Events are stuck in `pending` status
- Tag sync code never executes because events aren't processed

---

## Immediate Actions Required

### Step 1: Process Pending Events

Manually trigger event processing:

```bash
# Get the secret from .env.local
SECRET=$(grep X_DF_JOBS_SECRET .env.local | cut -d'=' -f2)

# Trigger processing (processes 10 events per call)
curl -X POST "https://df-middleware.vercel.app/api/jobs/process-pending" \
  -H "Authorization: Bearer $SECRET"
```

**Note:** With 42,430 events, you'll need to call this many times or increase batch size.

### Step 2: Check Cron Job Status

Verify Vercel Cron is running:
- Check Vercel dashboard → Cron Jobs
- Verify `/api/jobs/process-pending` is scheduled for `*/5 * * * *`
- Check logs for errors

### Step 3: Investigate Verity Message Forwarding

Check Verity logs for:
- Webhook forwarding errors
- Whether `DF_MIDDLEWARE_WEBHOOK_URL` is being called
- If broadcast messages use different code path

---

## Configuration Verification

### ✅ Verity Configuration (Correct)
```bash
DF_MIDDLEWARE_WEBHOOK_URL=https://df-middleware.vercel.app/api/webhooks/texting
DF_MIDDLEWARE_WEBHOOK_SECRET=8e3d9345c580e8069f981a78663f9214f136e3082cbf75b7d388feebf38e8fac
DF_MIDDLEWARE_API_KEY=622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c
BROADCAST_ANALYTICS_SYNC_VIA_MIDDLEWARE=true
```

### ✅ Middleware Configuration (Correct)
```bash
VERITY_WEBHOOK_SECRET=8e3d9345c580e8069f981a78663f9214f136e3082cbf75b7d388feebf38e8fac
VERITY_API_KEY=622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c
```

---

## Recommendations

### Short Term (Fix Now)

1. **Process Backlog:**
   - Increase batch size in `/api/jobs/process-pending` from 10 to 100
   - Run multiple times to clear backlog
   - Or use `run-once` endpoint to process sequentially

2. **Verify Cron:**
   - Check Vercel cron logs
   - Ensure job is running every 5 minutes
   - Fix any authentication errors

### Long Term (Prevent Future Issues)

1. **Increase Batch Size:**
   - Change `process-pending` batch size from 10 to 100
   - Process more events per cron run

2. **Add Monitoring:**
   - Alert when pending events exceed threshold
   - Monitor processing rate vs. incoming rate

3. **Fix Verity Message Forwarding:**
   - Ensure broadcast cadence messages forward to middleware
   - Add logging to track message forwarding
   - Verify all message sending paths call middleware webhook

---

## Next Steps

1. ✅ **Immediate:** Process pending events to unblock tag sync
2. ⚠️ **Investigate:** Why Verity isn't forwarding broadcast messages
3. 🔧 **Fix:** Increase batch size and verify cron job
4. 📊 **Monitor:** Set up alerts for pending event backlog

---

**Report Generated:** January 27, 2025
