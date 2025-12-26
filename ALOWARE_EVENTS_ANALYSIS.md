# Aloware Events Analysis

**Date:** December 26, 2024  
**Status:** Many events are stored but not processed

---

## Event Status Summary

| Event | Stored? | Processed? | Status | Notes |
|-------|---------|------------|--------|-------|
| **Contact Created** | ✅ | ✅ | **Handled** | Syncs contact to GHL |
| **Contact Updated** | ✅ | ✅ | **Handled** | Syncs contact to GHL |
| **Contact Disposed** | ✅ | ⚠️ | **Partially** | Stored as "contact" but treated as update (may need special handling) |
| **Contact DNC Updated** | ✅ | ⚠️ | **Partially** | Stored as "contact" but DNC status may not sync |
| **Communication Initiated** | ✅ | ❌ | **Not Processed** | Stored but router throws error |
| **Communication Disposed** | ✅ | ❌ | **Not Processed** | Stored but router throws error |
| **Appointment Saved** | ✅ | ❌ | **Not Processed** | Stored but router throws error |
| **Call Disposed** | ✅ | ✅ | **Handled** | Syncs call data to GHL |
| **Voicemail Saved** | ✅ | ❌ | **Not Processed** | Stored but router throws error |
| **Recording Saved** | ✅ | ❌ | **Not Processed** | Stored but router throws error |
| **Transcription Saved** | ✅ | ⚠️ | **Not Implemented** | Stored, marked "not-implemented" in sync_log |
| **Call Summarized** | ✅ | ❌ | **Not Processed** | Stored but router throws error |

---

## Current Implementation

### Webhook Handler (`/api/webhooks/aloware/route.ts`)

**Entity Type Detection:**
```typescript
const entityType = eventName.includes("Contact") ? "contact" :
    eventName.includes("PhoneCall") || eventName.includes("Call") ? "call" :
    eventName.includes("transcription") ? "transcription" :
    "unknown";
```

**What Gets Stored:**
- ✅ All events are stored in `webhook_events` table (if allowed)
- ✅ Events are deduplicated by `dedupeKey`
- ✅ Status set to `pending` for async processing

### Router (`src/lib/events/router.ts`)

**What Gets Processed:**
- ✅ `entityType="contact"` → Calls `syncAlowareContactToGHL()`
- ✅ `entityType="call"` → Calls `syncAlowareCallToGHL()`
- ⚠️ `entityType="transcription"` → Logs as "not-implemented"
- ❌ `entityType="unknown"` → **Throws error: "Unsupported Aloware entity type"**

---

## Issues Found

### 1. Many Events Stored But Not Processed

Events like `Communication Initiated`, `Appointment Saved`, `Voicemail Saved`, `Recording Saved`, `Call Summarized` are:
- ✅ Stored in database
- ❌ **Will fail when processed** (router throws error)
- ⚠️ Will accumulate as `status='error'` in `webhook_events` table

### 2. Contact Disposed / DNC Updated

These are stored as `entityType="contact"` and will trigger contact sync, but:
- **Contact Disposed** - May need special handling (mark contact as inactive/deleted in GHL?)
- **Contact DNC Updated** - DNC status may not be synced to GHL

### 3. Missing Entity Types

The router doesn't handle:
- `entityType="communication"` - For Communication Initiated/Disposed
- `entityType="appointment"` - For Appointment Saved
- `entityType="voicemail"` - For Voicemail Saved
- `entityType="recording"` - For Recording Saved
- `entityType="call_summary"` - For Call Summarized

---

## Recommendations

### Option 1: Handle All Events (Recommended)

Update the router to handle all event types:

1. **Contact Disposed** → Mark GHL contact as inactive/deleted
2. **Contact DNC Updated** → Sync DNC status to GHL (add DNC tag)
3. **Communication Initiated/Disposed** → Log only (or sync as activity)
4. **Appointment Saved** → Sync appointment to GHL calendar
5. **Voicemail Saved** → Attach voicemail to GHL contact
6. **Recording Saved** → Attach recording to GHL contact
7. **Transcription Saved** → Sync transcription to GHL contact notes
8. **Call Summarized** → Update GHL contact with call summary

### Option 2: Skip Unhandled Events

Update router to gracefully skip unhandled events instead of throwing errors:

```typescript
} else {
    // Unknown/unhandled event type - log and mark as done
    console.log(`[router] Unhandled Aloware event type: ${event.entityType} (${event.eventType})`);
    await db.insert(syncLog).values({
        direction: "aloware_to_ghl",
        entityType: event.entityType,
        entityId: event.entityId,
        sourceId: event.entityId,
        status: "skipped",
        finishedAt: new Date(),
        errorMessage: `Unhandled event type: ${event.eventType}`,
        correlationId,
    });
}
```

### Option 3: Update Entity Type Detection

Improve entity type detection in webhook handler:

```typescript
const entityType = 
    eventName.includes("Contact") ? "contact" :
    eventName.includes("PhoneCall") || eventName.includes("Call") ? "call" :
    eventName.includes("Communication") ? "communication" :
    eventName.includes("Appointment") ? "appointment" :
    eventName.includes("Voicemail") ? "voicemail" :
    eventName.includes("Recording") ? "recording" :
    eventName.includes("Transcription") ? "transcription" :
    eventName.includes("Summarized") ? "call_summary" :
    "unknown";
```

---

## Current Behavior

**What Happens Now:**

1. ✅ All events are received and stored
2. ✅ Events are enqueued for processing
3. ⚠️ **Contact/Call events process successfully**
4. ❌ **Other events fail with error** when router processes them
5. ⚠️ Failed events accumulate in `webhook_events` with `status='error'`

**Impact:**
- Contact and Call events work fine
- Other events will cause errors in logs
- Failed events need manual review/cleanup

---

## Next Steps

1. **Immediate Fix:** Update router to gracefully skip unhandled events (Option 2)
2. **Future Enhancement:** Implement handlers for missing event types (Option 1)
3. **Improvement:** Update entity type detection to be more specific (Option 3)

---

**Recommendation:** Implement Option 2 first to prevent errors, then gradually add handlers for important events (Contact Disposed, DNC Updated, Transcription Saved, etc.)

