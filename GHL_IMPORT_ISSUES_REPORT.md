# GHL Import Endpoints - Current Issues Report

**Date:** December 27, 2024  
**Integration:** Verity → GoHighLevel (GHL) Message Import  
**Status:** Blocked on API endpoint structure/requirements

---

## Executive Summary

We are attempting to import historical SMS messages from Verity (proprietary texting system) to GoHighLevel (GHL) using GHL's import endpoints. We've successfully updated the code to use the correct import endpoints (`/conversations/messages/inbound` and `/outbound`), but are encountering API validation errors indicating that `conversationProviderId` is required in the request body, even though these are historical import endpoints that should not require provider configuration.

---

## Background

### Original Problem
Initially, we were using the wrong GHL endpoint:
- **Wrong:** `POST /conversations/messages` (live SMS endpoint)
- **Error:** `type must be a valid enum value` (422)
- **Root Cause:** Live endpoint requires `type` field tied to a configured provider (Twilio, LeadConnector, etc.)

### Solution Implemented
Switched to GHL's import endpoints:
- **Correct:** `POST /conversations/messages/inbound` (for inbound messages)
- **Correct:** `POST /conversations/messages/outbound` (for outbound messages)
- **Expected:** These endpoints should NOT require `type` or provider configuration

---

## Current Issue

### Error Message
```
GHL API error (400): No conversationProviderId passed in body
```

### Affected Messages
- 2 out of 3 messages failing with this error
- 1 message still showing old "type must be a valid enum value" error (possibly cached)

### Test Case
- **Contact:** Lan Nguyen (`+19192715870`)
- **GHL Contact ID:** `A94aNbVMezt0w4N4rVE5`
- **Verity Contact ID:** `7ed6e558-926f-4d72-b99f-360683292754`
- **Messages Found:** 3
- **Messages Imported:** 0
- **Errors:** 3

---

## Current Implementation

### Endpoint URLs
- Base URL: `https://services.leadconnectorhq.com`
- Inbound: `POST /conversations/messages/inbound?locationId={locationId}`
- Outbound: `POST /conversations/messages/outbound?locationId={locationId}`

### Current Payload Structure

#### Inbound Message
```json
{
  "contactId": "A94aNbVMezt0w4N4rVE5",
  "message": "Hello",
  "phone": "+19192715870",
  "date": "2024-12-27T18:12:00Z"
}
```

#### Outbound Message
```json
{
  "contactId": "A94aNbVMezt0w4N4rVE5",
  "message": "Hi there",
  "phone": "+19192715870",
  "date": "2024-12-27T18:13:00Z",
  "userId": "optional-user-id"
}
```

### Request Headers
```
Authorization: Bearer {GHL_API_KEY}
Accept: application/json
Version: 2021-07-28
Content-Type: application/json
```

---

## What We've Tried

### 1. Removed `type` Field ✅
- **Action:** Removed `type: "sms"` from payload
- **Result:** Fixed "type must be a valid enum value" error for most messages
- **Status:** Working

### 2. Changed `phoneNumber` → `phone` ✅
- **Action:** Updated field name to match GHL API
- **Result:** No change in error
- **Status:** Applied

### 3. Removed `locationId` from Body ✅
- **Action:** Removed `locationId` from body (already in query string)
- **Result:** No change in error
- **Status:** Applied

### 4. Added `date` Field ✅
- **Action:** Added ISO timestamp for historical messages
- **Result:** No change in error
- **Status:** Applied

### 5. Added `conversationProviderId: ""` ❌
- **Action:** Added empty string for `conversationProviderId`
- **Result:** Still getting "No conversationProviderId passed in body" error
- **Status:** Failed

### 6. Added `conversationProviderId: null` ❌
- **Action:** Added null value for `conversationProviderId`
- **Result:** Still getting "No conversationProviderId passed in body" error
- **Status:** Failed

### 7. Omitted `conversationProviderId` ❌
- **Action:** Removed field entirely
- **Result:** Still getting "No conversationProviderId passed in body" error
- **Status:** Failed

---

## Code Implementation

### File: `src/lib/ghl/conversations.ts`

#### Inbound Message Function
```typescript
export async function addInboundMessage(
	contactId: string,
	message: string,
	options?: {
		conversationId?: string;
		phoneNumber?: string;
		mediaUrl?: string;
		userId?: string;
		date?: string | Date;
	}
): Promise<string> {
	const locationId = env.GHL_LOCATION_ID;
	const endpoint = "/conversations/messages/inbound";
	const body: Record<string, unknown> = {
		contactId,
		message,
	};

	if (options?.phoneNumber) {
		body.phone = options.phoneNumber;
	}

	if (options?.date) {
		const dateValue = options.date instanceof Date 
			? options.date.toISOString() 
			: options.date;
		body.date = dateValue;
	} else {
		body.date = new Date().toISOString();
	}

	// ... other optional fields

	const response = await ghlRequest(endpoint, {
		method: "POST",
		body: JSON.stringify(body),
	});
	// ...
}
```

---

## Research Questions

### 1. Endpoint Path Verification
- **Question:** Is `/conversations/messages/inbound` the correct endpoint path?
- **Alternatives to Check:**
  - `/conversations/inbound`
  - `/messages/inbound`
  - `/conversations/messages/inbound/message`
  - Different base path entirely?

### 2. conversationProviderId Requirement
- **Question:** Is `conversationProviderId` actually required for import endpoints?
- **If Required:**
  - What value should be used for historical imports?
  - Should it be `null`, empty string, or omitted?
  - Is there a special "import" provider ID?
  - Do we need to create/get a provider first?

### 3. Payload Structure
- **Question:** What is the exact required payload structure?
- **Fields to Verify:**
  - Required vs optional fields
  - Field names (e.g., `phone` vs `phoneNumber`)
  - Data types (e.g., date format)
  - Nested structures

### 4. API Version
- **Question:** Are we using the correct API version?
- **Current:** `Version: 2021-07-28`
- **Check:** If import endpoints require a different version

### 5. Authentication/Authorization
- **Question:** Are there any special permissions or scopes needed?
- **Current:** Using Private Integration Token (PIT)
- **Check:** If import endpoints require different auth

### 6. Conversation Creation
- **Question:** Do we need to create/get a conversation first?
- **Current:** Relying on GHL to auto-create conversations
- **Check:** If import endpoints require an existing conversation with a provider

---

## Expected Behavior (Based on User Guidance)

According to the user's guidance:
- Import endpoints should NOT require `type` field ✅ (confirmed)
- Import endpoints should NOT require provider configuration ❓ (currently failing)
- Import endpoints should accept historical timestamps ✅ (implemented)
- Import endpoints should auto-create conversations ✅ (assumed)

---

## GHL API Documentation References

### Current Documentation Links
- Base: https://marketplace.gohighlevel.com/docs/ghl/conversations/messages
- Conversations API: https://marketplace.gohighlevel.com/docs/ghl/conversations/

### What to Research
1. Exact endpoint paths for historical message imports
2. Required vs optional fields for import endpoints
3. `conversationProviderId` field requirements
4. Example payloads for import endpoints
5. Any special considerations for historical imports

---

## Test Endpoint

### Local Test Endpoint
```
POST http://localhost:3000/api/test/import-verity-conversations
Content-Type: application/json

{
  "chatMessageId": "09550cc3-231e-4daa-9c5c-7450e4da4eca"
}
```

### Expected Response
```json
{
  "success": true,
  "messagesImported": 3,
  "errors": 0,
  "importedMessages": [...]
}
```

### Actual Response
```json
{
  "success": true,
  "messagesImported": 0,
  "errors": 3,
  "errorDetails": [
    {
      "messageId": "d263fb48-7a10-4fa0-82a2-9e67d08f5601",
      "error": "GHL API error (422): type must be a valid enum value,type should not be empty"
    },
    {
      "messageId": "09550cc3-231e-4daa-9c5c-7450e4da4eca",
      "error": "GHL API error (400): No conversationProviderId passed in body"
    },
    {
      "messageId": "6d82ce64-c30e-4b7e-ae50-83a1da430033",
      "error": "GHL API error (400): No conversationProviderId passed in body"
    }
  ]
}
```

---

## Environment Details

### GHL Configuration
- **API Base URL:** `https://services.leadconnectorhq.com`
- **API Version:** `2021-07-28`
- **Authentication:** Private Integration Token (PIT)
- **Location ID:** Configured in environment variables

### Integration Context
- **Source System:** Verity (proprietary texting system)
- **Target System:** GoHighLevel (GHL)
- **Use Case:** Import historical SMS conversations and messages
- **Direction:** Bidirectional sync (inbound and outbound messages)

---

## Next Steps for Research

1. **Verify Endpoint Paths**
   - Check GHL API documentation for exact import endpoint paths
   - Test alternative endpoint structures if current path is incorrect

2. **Investigate conversationProviderId**
   - Determine if field is required for import endpoints
   - Find correct value/format if required
   - Check if there's a way to omit it for historical imports

3. **Review Payload Structure**
   - Compare current payload with official GHL API examples
   - Verify all field names and data types
   - Check for any missing required fields

4. **Test Alternative Approaches**
   - Try creating conversation first, then importing messages
   - Check if provider needs to be configured even for imports
   - Investigate if there's a different import workflow

5. **Contact GHL Support (if needed)**
   - If documentation is unclear, reach out to GHL support
   - Ask specifically about historical message import endpoints
   - Request example payloads for import endpoints

---

## Files Modified

1. `src/lib/ghl/conversations.ts` - Updated `addInboundMessage()` and `sendOutboundMessage()` functions
2. `src/lib/ghl/client.ts` - Added detailed error logging
3. `src/app/api/test/import-verity-conversations/route.ts` - Test endpoint for importing Verity conversations

---

## Additional Context

- The user mentioned that import endpoints should NOT require `type` or provider configuration
- We have access to GHL MCP server for documentation (though it's primarily for reference)
- The integration is for internal use (DiversyFund), not a public GHL app
- We're using direct API access with Private Integration Token (PIT)

---

## Success Criteria

The import should work when:
- ✅ Messages are successfully imported to GHL
- ✅ Historical timestamps are preserved
- ✅ Conversations are auto-created or found correctly
- ✅ No API validation errors
- ✅ Messages appear in GHL conversation timeline with correct dates

---

**End of Report**

