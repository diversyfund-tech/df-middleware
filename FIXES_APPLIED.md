# Fixes Applied - January 27, 2025

## ✅ Issue 1: Process Today's Events

**Problem:** 42,430+ pending events blocking tag sync and contact updates

**Fix Applied:**
- Increased batch size from 10 to 100 in `/api/jobs/process-pending`
- Created script to process today's events (can be run manually)

**To Process Today's Events:**

Option 1: Use API endpoint (recommended)
```bash
SECRET=$(grep X_DF_JOBS_SECRET .env.local | cut -d'=' -f2)
curl -X POST "https://df-middleware.vercel.app/api/jobs/process-pending" \
  -H "Authorization: Bearer $SECRET"
```

Option 2: Run script locally
```bash
pnpm tsx scripts/process-today-events.ts
```

**Note:** The cron job will now process 100 events every 5 minutes (instead of 10), so it will catch up faster.

---

## ✅ Issue 2: Broadcast Messages Not Forwarding to Middleware

**Problem:** Broadcast cadence messages bypassed `sendSms` workflow and called Telnyx directly, so middleware never received webhooks.

**Fix Applied:**
- Updated `/Users/jaredlutz/Github/verity/src/lib/comms/workflows/broadcasts/sendBroadcastRecipient.ts`
- Added middleware webhook forwarding after successful message send (lines 236-276)
- Matches the same pattern used in `sendSms` workflow

**Changes:**
- After successfully sending broadcast message via Telnyx
- Forwards webhook to `DF_MIDDLEWARE_WEBHOOK_URL` with:
  - `eventType: "message.sent"`
  - `messageId`: Telnyx message ID
  - `conversationId`: Chat ID (required for GHL)
  - `direction: "outbound"`
  - `from`, `to`, `body`, `timestamp`, `status`
  - `raw` payload with broadcast metadata

**Result:**
- Broadcast cadence messages will now sync to GHL via middleware
- Messages will appear in GHL conversations
- Tag sync will work once today's events are processed

---

## Next Steps

1. **Deploy Verity Changes:**
   - Commit and deploy the updated `sendBroadcastRecipient.ts`
   - Future broadcast messages will forward to middleware

2. **Process Today's Events:**
   - Run the API endpoint or script to process today's pending events
   - This will unblock tag sync and contact updates

3. **Monitor:**
   - Check that new broadcast messages appear in middleware
   - Verify tags are syncing after events are processed
   - Monitor pending event count to ensure it's decreasing

---

## Files Modified

### DF Middleware
- `src/app/api/jobs/process-pending/route.ts` - Increased batch size to 100
- `scripts/process-today-events.ts` - Created script to process today's events

### Verity
- `src/lib/comms/workflows/broadcasts/sendBroadcastRecipient.ts` - Added middleware webhook forwarding

---

**Status:** ✅ Fixes applied and ready for deployment
