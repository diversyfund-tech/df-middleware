# GHL Import Endpoints Debugging

## Current Status
- ✅ Updated endpoints from `/conversations/messages` to `/conversations/messages/inbound` and `/outbound`
- ✅ Removed `type` field (not needed for imports)
- ✅ Added `date` field for historical timestamps
- ✅ Changed `phoneNumber` → `phone` (GHL API field name)
- ✅ Removed `locationId` from body (already in query string)
- ❌ Still getting error: "No conversationProviderId passed in body"

## Current Payload Structure

### Inbound Message
```json
{
  "contactId": "A94aNbVMezt0w4N4rVE5",
  "message": "Hello",
  "phone": "+19192715870",
  "date": "2024-12-27T18:12:00Z"
}
```

### Outbound Message
```json
{
  "contactId": "A94aNbVMezt0w4N4rVE5",
  "message": "Hi there",
  "phone": "+19192715870",
  "date": "2024-12-27T18:13:00Z",
  "userId": "optional-user-id"
}
```

## Error Details
- **Error**: `GHL API error (400): No conversationProviderId passed in body`
- **Endpoint**: `POST /conversations/messages/inbound` and `/outbound`
- **URL**: `https://services.leadconnectorhq.com/conversations/messages/inbound?locationId=xxx`

## Possible Issues

1. **Endpoint Path**: Maybe the import endpoints are at a different path?
   - Current: `/conversations/messages/inbound`
   - Alternative: `/conversations/inbound` or `/messages/inbound`?

2. **conversationProviderId Required**: Maybe imports DO need a provider ID?
   - Could be `null` or empty string for historical imports?
   - Could be a specific "import" provider ID?

3. **Conversation Must Exist First**: Maybe we need to create/get the conversation first, and that conversation needs a provider?

4. **Different API Version**: Maybe the import endpoints require a different API version header?

## Next Steps to Try

1. Check GHL API docs for exact endpoint structure
2. Try passing `conversationProviderId: null` or empty string
3. Try creating conversation first with provider, then importing messages
4. Check if endpoint should be `/conversations/inbound` instead of `/conversations/messages/inbound`
5. Review actual API response body for more details

