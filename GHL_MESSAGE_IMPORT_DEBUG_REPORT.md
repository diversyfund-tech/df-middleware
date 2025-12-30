# GHL Message Import Debug Report

**Date:** January 2025  
**Status:** 🔴 Blocked - Provider Validation Error  
**Issue:** Cannot import messages to GHL due to "Incorrect conversationProviderId/type" or "type must be a valid enum value" errors

---

## Executive Summary

We are attempting to import historical SMS messages from Verity (proprietary texting system) into GoHighLevel (GHL) Conversations using a Marketplace App with a custom SMS conversation provider. All infrastructure is working correctly (OAuth, database, contact sync), but message import fails with provider/type validation errors.

**Current Blocker:** GHL API rejects message import requests with either:
- `400: Incorrect conversationProviderId/type` (when using `type: "SMS"`)
- `422: type must be a valid enum value` (when using `type: "sms"` or other values)

---

## Architecture Overview

### Components Working ✅

1. **OAuth Token Management**
   - ✅ OAuth flow completed successfully
   - ✅ Tokens stored in database (`ghl_oauth_tokens` table)
   - ✅ Token retrieval working (`getGhlAccessToken()`)
   - ✅ Token refresh logic implemented

2. **Contact Synchronization**
   - ✅ Verity contacts sync to GHL successfully
   - ✅ Contact creation/update working
   - ✅ Contact ID mapping stored

3. **Database Integration**
   - ✅ Verity database connection working
   - ✅ Message retrieval from Verity working
   - ✅ Contact and message mappings stored

4. **GHL API Client**
   - ✅ OAuth authentication working
   - ✅ PIT fallback working
   - ✅ Request/response handling working

### Component Failing ❌

**Message Import Endpoint**
- ❌ `POST /conversations/messages/inbound` - Fails with provider/type validation
- ❌ `POST /conversations/messages/outbound` - Same issue

---

## Configuration Details

### GHL Marketplace App

- **App Type:** Private Marketplace App
- **Provider Type:** SMS (Custom Conversation Provider)
- **Provider ID:** `695403c62238096934880f15`
- **Location ID:** `CTaxuyy2bMObvSaBQRxY`
- **OAuth Client ID:** `6953d6aa4b770d0bf8434e1d-mjsthmxx`
- **Redirect URLs:**
  - `https://df-middleware.vercel.app/leadconnector/oauth`
  - `http://localhost:3000/leadconnector/oauth`

### Provider Configuration

- ✅ "Custom Conversation Provider" checkbox: **Checked** (confirmed by user)
- ✅ Provider visible in GHL Settings → Conversation Providers
- ✅ Provider linked to Marketplace App
- ✅ Delivery URL configured (for outbound messages)

### Environment Variables

```bash
GHL_CONVERSATION_PROVIDER_ID=695403c62238096934880f15
GHL_CLIENT_ID=6953d6aa4b770d0bf8434e1d-mjsthmxx
GHL_CLIENT_SECRET=<encrypted>
GHL_LOCATION_ID=CTaxuyy2bMObvSaBQRxY
```

**Note:** All values are trimmed in code to handle potential whitespace/newlines.

---

## Error Progression & Testing

### Test 1: With `type: "SMS"` (uppercase)
```json
{
  "locationId": "CTaxuyy2bMObvSaBQRxY",
  "contactId": "A94aNbVMezt0w4N4rVE5",
  "conversationProviderId": "695403c62238096934880f15",
  "message": "Test",
  "type": "SMS",
  "phone": "+19192715870",
  "dateSent": "2025-01-XX..."
}
```
**Result:** `400: Incorrect conversationProviderId/type`

### Test 2: Without `type` field
```json
{
  "locationId": "...",
  "contactId": "...",
  "conversationProviderId": "...",
  "message": "Test"
  // No type field
}
```
**Result:** `422: type must be a valid enum value,type should not be empty`

### Test 3: With `type: "sms"` (lowercase)
```json
{
  ...
  "type": "sms"
}
```
**Result:** `422: type must be a valid enum value`

### Test 4: Conversation Creation Attempt
```json
POST /conversations
{
  "locationId": "CTaxuyy2bMObvSaBQRxY",
  "contactId": "A94aNbVMezt0w4N4rVE5",
  "conversationProviderId": "695403c62238096934880f15"
}
```
**Result:** `404: Not Found` (endpoint may not exist for Marketplace App providers)

---

## Code Implementation

### Current Message Import Payload

**File:** `src/lib/ghl/conversations.ts`

```typescript
// Inbound message import
const body = {
  locationId,
  contactId,
  conversationProviderId, // Trimmed: "695403c62238096934880f15"
  message,
  type: "sms", // Currently lowercase, tried "SMS" before
  phone: options?.phoneNumber,
  dateSent: new Date().toISOString(),
};

await ghlRequest(
  "/conversations/messages/inbound",
  {
    method: "POST",
    body: JSON.stringify(body),
  },
  true // useOAuth = true
);
```

### Authentication

- ✅ Using OAuth token (not PIT) for provider-related calls
- ✅ Token retrieved successfully: `eyJhbGciOi...` (JWT format)
- ✅ Token has proper scopes (confirmed during OAuth flow)

---

## API Endpoints Tested

### Working Endpoints ✅

1. **OAuth Token Exchange**
   - `POST https://services.leadconnectorhq.com/oauth/token`
   - ✅ Successfully exchanges authorization code for access token

2. **Contact Creation/Update**
   - `POST /contacts`
   - ✅ Successfully creates/updates contacts

### Failing Endpoints ❌

1. **Message Import (Inbound)**
   - `POST /conversations/messages/inbound`
   - ❌ Fails with provider/type validation error

2. **Message Import (Outbound)**
   - `POST /conversations/messages/outbound`
   - ❌ Same error (not tested separately, but uses same code)

3. **Conversation Creation**
   - `POST /conversations`
   - ❌ Returns 404 (may not be available for Marketplace App providers)

4. **Provider Listing**
   - `GET /conversations/providers`
   - `GET /conversation-providers`
   - `GET /providers`
   - ❌ All return 404 (no public API to list providers)

---

## Research Questions for ChatGPT Advisor

### Critical Questions

1. **What is the correct `type` enum value for SMS messages in GHL import endpoints?**
   - We've tried: `"SMS"`, `"sms"`, `""` (empty)
   - GHL documentation mentions `type` but doesn't specify exact enum values
   - Need definitive answer: What are valid enum values for `/conversations/messages/inbound`?

2. **Does the `type` field need to match the provider's configured type exactly?**
   - Provider is configured as "SMS" in Marketplace App
   - Should `type` in payload match this exactly? Case-sensitive?

3. **Is `conversationProviderId` validation case-sensitive or format-sensitive?**
   - Provider ID: `695403c62238096934880f15` (24 hex characters)
   - Is this the correct format? Should it have a prefix like `convprov_`?

4. **Do Marketplace App providers require special configuration for message imports?**
   - Provider is created and visible in GHL Settings
   - "Custom Conversation Provider" is checked
   - Is there an activation step we're missing?

5. **Are there additional OAuth scopes required for message imports?**
   - Current scopes granted during OAuth flow
   - Do we need specific scopes for importing messages vs. sending live messages?

6. **Does GHL auto-create conversations when importing messages without `conversationId`?**
   - We're not providing `conversationId` in the payload
   - Should we create conversations first? (But `/conversations` POST returns 404)

7. **Is there a difference between import endpoints and live message endpoints?**
   - We're using `/conversations/messages/inbound` (import endpoint)
   - Should we use a different endpoint for Marketplace App providers?

### Documentation References

- GHL Marketplace API Docs: https://marketplace.gohighlevel.com/docs/ghl/conversations/messages
- Provider ID was obtained from GHL Marketplace App dashboard (not via API)

---

## Test Results Summary

| Test | Type Value | Result | Error |
|------|------------|--------|-------|
| 1 | `"SMS"` | ❌ | `400: Incorrect conversationProviderId/type` |
| 2 | `""` (empty) | ❌ | `422: type must be a valid enum value,type should not be empty` |
| 3 | `"sms"` | ❌ | `422: type must be a valid enum value` |
| 4 | Conversation creation | ❌ | `404: Not Found` |

---

## Next Steps (Pending Research)

1. **Identify correct `type` enum value**
   - Research GHL API documentation for exact enum values
   - Check if type should match provider configuration exactly

2. **Verify provider ID format**
   - Confirm if provider ID needs prefix or different format
   - Verify provider ID is correct from GHL dashboard

3. **Check provider activation**
   - Verify if provider needs additional activation steps
   - Check if provider is fully configured for imports

4. **Review OAuth scopes**
   - Confirm all required scopes are granted
   - Check if additional scopes needed for imports

5. **Alternative approaches**
   - Consider if conversation creation is required first
   - Check if different endpoint should be used
   - Verify if Marketplace App providers work differently than default providers

---

## Code Files Involved

- `src/lib/ghl/conversations.ts` - Message import functions
- `src/lib/ghl/client.ts` - GHL API client with OAuth support
- `src/lib/ghl/oauth-tokens.ts` - OAuth token management
- `src/app/api/test/test-message-import/route.ts` - Test endpoint
- `src/app/api/test/test-provider-connection/route.ts` - Provider connection test
- `src/app/api/test/test-type-values/route.ts` - Type enum testing

---

## Environment

- **Platform:** Vercel (Production)
- **Database:** Neon PostgreSQL
- **GHL API Base:** `https://services.leadconnectorhq.com`
- **API Version:** `2021-07-28`

---

## Conclusion

All infrastructure is working correctly. The blocker is specifically with GHL's validation of the `conversationProviderId` and `type` fields when importing messages. We need definitive answers on:

1. **Correct `type` enum value** for SMS message imports
2. **Provider ID format/validation** requirements
3. **Any additional configuration** needed for Marketplace App providers

Once these are resolved, message import should work immediately as all other components are functional.

