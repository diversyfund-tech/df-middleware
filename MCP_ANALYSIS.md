# GHL MCP Analysis for Message Import

## MCP Function Available

**Function:** `conversations_send-a-new-message`

**Purpose:** Send a NEW message (live channel messages)

**Type Enum Values:**
```typescript
"SMS" | "Email" | "WhatsApp" | "IG" | "FB" | "Custom" | "Live_Chat"
```

**Key Finding:** The MCP confirms that for **live messages**, `"SMS"` (uppercase) is a valid type value.

## Important Distinction

### Live Messages (MCP Function)
- **Endpoint:** `POST /conversations/messages`
- **Type:** `"SMS"` (uppercase) ✅ Valid according to MCP
- **Purpose:** Send real-time SMS through configured providers
- **Requires:** Active provider connection (Twilio, LeadConnector, etc.)

### Historical Import (Our Use Case)
- **Endpoint:** `POST /conversations/messages/inbound` or `/outbound`
- **Type:** ❓ Unknown - MCP doesn't have functions for imports
- **Purpose:** Import historical messages into conversation timeline
- **Requires:** `conversationProviderId` from Marketplace App

## MCP Limitations

1. **No Import Functions:** The MCP doesn't expose functions for historical message imports
2. **No Provider Info:** Can't query provider details or configuration
3. **No Enum Documentation:** Doesn't document import endpoint type values

## What We Learned

1. ✅ `"SMS"` (uppercase) is valid for **live messages**
2. ❓ Import endpoints may use different type values or format
3. ❓ The `"Incorrect conversationProviderId/type"` error suggests both fields are validated together

## Conclusion

The MCP confirms `"SMS"` works for live messages, but:
- We're using **import endpoints**, not live message endpoints
- Import endpoints may have different requirements
- The error suggests the issue might be with `conversationProviderId` validation, not just `type`

## Next Steps

Since MCP can't help with import endpoints, we need to:
1. Verify provider ID format/validity in GHL dashboard
2. Check if import endpoints require different type values
3. Confirm provider is fully activated for imports
4. Research GHL documentation for import endpoint specifics

