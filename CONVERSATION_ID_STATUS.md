# conversationId Configuration Status

**Date:** January 27, 2025

---

## Current Status

### ❌ **ISSUE FOUND:** Verity's Outbound Webhook Missing conversationId

---

## Configuration Check

### 1. Verity - Inbound Messages ✅ CORRECT

**File:** `src/lib/comms/workflows/handleInboundSms.ts` (Line 291)

```typescript
const middlewarePayload = {
  eventType: "message.received",
  messageId: payload.telnyxMessageId,
  conversationId: existingChat.id,  // ✅ INCLUDED
  direction: "inbound",
  ...
};
```

**Status:** ✅ **Correctly configured** - Includes `conversationId`

---

### 2. Verity - Outbound Messages ❌ MISSING conversationId

**File:** `src/lib/comms/workflows/sendSms.ts` (Lines 177-190)

**Current Code:**
```typescript
const middlewarePayload = {
  eventType: "message.sent",
  messageId: telnyxMessageId,
  // ❌ MISSING conversationId
  direction: "outbound",
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

**Status:** ❌ **Missing conversationId** - This is CRITICAL for GHL outbound messages

**Available Data:**
- `message` object is loaded at line 28: `const message = await db.query.chatMessage.findFirst(...)`
- `message.chatId` contains the conversation ID
- This should be added to the payload

---

### 3. DF Middleware - Handling conversationId ⚠️ PARTIAL

**File:** `src/lib/sync/texting-to-ghl.ts` (Lines 106-114)

**Current Code:**
```typescript
} else {
  const { sendOutboundMessage } = await import("@/lib/ghl/conversations");
  ghlMessageId = await sendOutboundMessage(
    ghlContactId,
    payload.body || "",
    {
      phoneNumber: phone,
      // ⚠️ Not passing conversationId from payload
    }
  );
}
```

**Status:** ⚠️ **Partially configured**
- DF Middleware stores `payload.conversationId` in message mappings (line 132)
- But doesn't pass it to `sendOutboundMessage`
- However, `sendOutboundMessage` will create/get conversation if not provided (lines 262-272 in conversations.ts)

**Impact:** 
- Will work (conversation will be created)
- But won't use Verity's conversationId for consistency
- Less efficient (creates new conversation instead of using existing)

---

## The Problem

**For outbound messages:**
1. Verity doesn't include `conversationId` in webhook payload
2. DF Middleware doesn't use `conversationId` from payload even if it existed
3. GHL requires `conversationId` for outbound messages (will create if not provided, but less efficient)

**Result:**
- Messages will sync, but may create duplicate conversations
- Less efficient than using Verity's conversationId

---

## Required Fixes

### Fix 1: Verity - Add conversationId to Outbound Webhook (CRITICAL)

**File:** `/Users/jaredlutz/Github/verity/src/lib/comms/workflows/sendSms.ts`

**Change Lines 177-190:**

**Before:**
```typescript
const middlewarePayload = {
  eventType: "message.sent",
  messageId: telnyxMessageId,
  direction: "outbound",
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

**After:**
```typescript
const middlewarePayload = {
  eventType: "message.sent",
  messageId: telnyxMessageId,
  conversationId: message.chatId,  // ✅ ADD THIS
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

**Note:** `message` object is already loaded at line 28, so `message.chatId` is available.

---

### Fix 2: DF Middleware - Use conversationId from Payload (OPTIONAL but Recommended)

**File:** `/Users/jaredlutz/Github/df-middleware/src/lib/sync/texting-to-ghl.ts`

**Change Lines 106-114:**

**Before:**
```typescript
} else {
  const { sendOutboundMessage } = await import("@/lib/ghl/conversations");
  ghlMessageId = await sendOutboundMessage(
    ghlContactId,
    payload.body || "",
    {
      phoneNumber: phone,
    }
  );
}
```

**After:**
```typescript
} else {
  const { sendOutboundMessage } = await import("@/lib/ghl/conversations");
  ghlMessageId = await sendOutboundMessage(
    ghlContactId,
    payload.body || "",
    {
      phoneNumber: phone,
      conversationId: payload.conversationId || undefined,  // ✅ ADD THIS
    }
  );
}
```

**Impact:** Will use Verity's conversationId if available, creating conversation only if needed.

---

## Priority

1. **Fix 1 (Verity)** - 🔴 **CRITICAL** - Must fix to include conversationId
2. **Fix 2 (DF Middleware)** - 🟡 **RECOMMENDED** - Improves efficiency and consistency

---

## Testing After Fixes

1. Send outbound message from Verity
2. Check Verity webhook payload includes `conversationId`
3. Check DF Middleware uses `conversationId` when calling GHL API
4. Verify message appears in correct GHL conversation (not duplicate)

---

## Summary

| System | Direction | conversationId Status | Action Needed |
|--------|-----------|---------------------|---------------|
| **Verity** | Inbound | ✅ Included | None |
| **Verity** | Outbound | ❌ Missing | **FIX REQUIRED** |
| **DF Middleware** | Inbound | ✅ Works (creates if needed) | None |
| **DF Middleware** | Outbound | ⚠️ Doesn't use payload | **RECOMMENDED FIX** |

---

**Bottom Line:** Verity's outbound webhook is missing `conversationId`, which is critical for GHL. This must be fixed.

