# Fix: Add conversationId to Outbound Webhook

## Issue

The `sendSms` workflow forwards webhooks to DF Middleware but doesn't include `conversationId` in the payload. This makes it harder to track conversations.

## Current Code

**File:** `src/lib/comms/workflows/sendSms.ts` (Lines 174-209)

```typescript
// Forward webhook to DF Middleware (if configured)
if (process.env.DF_MIDDLEWARE_WEBHOOK_URL) {
  try {
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
    // ... fetch call
  }
}
```

## Recommended Fix

The `message` object is already loaded at line 28, so we can use `message.chatId`:

```typescript
// Forward webhook to DF Middleware (if configured)
if (process.env.DF_MIDDLEWARE_WEBHOOK_URL) {
  try {
    const middlewarePayload = {
      eventType: "message.sent",
      messageId: telnyxMessageId,
      conversationId: message.chatId,  // ← Add this
      direction: "outbound",
      from: payload.from,
      to: Array.isArray(payload.to) ? payload.to[0] : payload.to,
      body: payload.text || "",
      timestamp: new Date().toISOString(),
      status: "sent",
      raw: {
        telnyxMessageId,
        chatMessageId: payload.chatMessageId,
        chatId: message.chatId,  // ← Add this too
      },
    };

    await fetch(process.env.DF_MIDDLEWARE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.DF_MIDDLEWARE_WEBHOOK_SECRET && {
          "X-Texting-Secret": process.env.DF_MIDDLEWARE_WEBHOOK_SECRET,
        }),
      },
      body: JSON.stringify(middlewarePayload),
    }).catch((error) => {
      // Don't fail the workflow if middleware forwarding fails
      console.error("[sendSms] Failed to forward to middleware:", error);
    });
  } catch (error) {
    // Don't fail the workflow if middleware forwarding fails
    console.error("[sendSms] Error forwarding to middleware:", error);
  }
}
```

## Impact

- ✅ Better conversation tracking in DF Middleware
- ✅ Consistent with inbound message webhooks
- ✅ No breaking changes (conversationId is optional in middleware)
- ✅ Low risk (already have message object loaded)

## Priority

**Low** - Not critical, but recommended for consistency and better tracking.


