# MCP Call Attempt Results

**Date:** 2026-01-22  
**Test:** Initiate AI call to Jared Lutz (+19492459055)  
**Status:** ⚠️ Authentication Required

## Summary

Attempted to initiate an AI call using the MCP server. The MCP server is working correctly, but the Verity API requires Clerk JWT authentication which is not currently configured.

## What Was Fixed

1. ✅ **Path Conversion**: Updated `proxy.ts` to convert `/apicalls/...` to `/api/calls/...` to match Verity's actual route structure
2. ✅ **Request Format**: Verified the endpoint expects `{"to": "+19492459055"}` in the request body

## Current Issue

The Verity API endpoint `/api/calls/agents/[agentId]/test` requires Clerk authentication:

```typescript
const { userId } = await auth();
if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

The MCP server is currently sending:
- `Authorization: Bearer <VERITY_API_KEY>` 

But Verity expects:
- Clerk JWT token in the Authorization header

## Next Steps

### Option 1: Implement Clerk Authentication (Recommended for Production)

1. Get a Clerk JWT token from a logged-in session
2. Pass the Clerk token through the MCP server
3. Update the proxy to forward Clerk tokens instead of API keys

### Option 2: Test with Valid Agent ID

The endpoint also requires a valid agent ID. The test used `"test-agent"` which may not exist. To find valid agent IDs:

1. List agents: `GET /api/calls/agents` (requires Clerk auth)
2. Or check the Verity database for existing agent IDs

### Option 3: Bypass Auth for Local Testing (Development Only)

If Verity has a development mode that bypasses authentication, we could:
1. Add an environment variable to disable auth checks
2. Or use a test Clerk token for local development

## Technical Details

### Endpoint Structure
- **API Catalog Path**: `/apicalls/agents/{agentId}/test`
- **Actual Verity Route**: `/api/calls/agents/[agentId]/test`
- **Path Conversion**: ✅ Fixed in `proxy.ts`

### Request Format
```json
{
  "to": "+19492459055",
  "from": "+1234567890"  // Optional
}
```

### Response Format (on success)
```json
{
  "success": true,
  "callId": "...",
  "conversationId": "...",
  "status": "..."
}
```

## Files Modified

- `src/api-gateway/proxy.ts`: Added path conversion from `/apicalls` to `/api/calls`

## MCP Server Status

✅ **Working Correctly**
- Tool generation: ✅
- Request routing: ✅
- Path parameter extraction: ✅
- Body formatting: ✅
- Error handling: ✅

⚠️ **Blocked By**
- Clerk authentication not configured
- Need valid agent ID
