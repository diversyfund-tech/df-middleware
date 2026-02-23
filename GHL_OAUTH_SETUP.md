# GHL OAuth Setup - Complete

## OAuth Credentials Added

✅ **Client ID:** `6953d6aa4b770d0bf8434e1d-mjsthmxx`  
✅ **Client Secret:** `c5ee14da-f39c-4061-a2d7-1714aa924db1`

## Redirect URLs Configured

✅ **Development:** `http://localhost:3000/leadconnector/oauth`  
✅ **Production:** `https://df-middleware.vercel.app/leadconnector/oauth`

## What Was Created

### 1. Environment Variables (`env.mjs` & `.env.local`)
- ✅ `GHL_CLIENT_ID` - OAuth client ID
- ✅ `GHL_CLIENT_SECRET` - OAuth client secret
- ✅ Added to type definitions (`env.d.ts`)

### 2. OAuth Callback Endpoint
**Path:** `/leadconnector/oauth`  
**File:** `src/app/leadconnector/oauth/route.ts`

**What it does:**
- Receives OAuth callback from GHL after app installation
- Exchanges authorization code for access token
- Handles errors gracefully
- Redirects to success/error page

**Flow:**
```
User installs app in GHL
  ↓
GHL redirects to: /leadconnector/oauth?code=xxx&state=xxx
  ↓
Endpoint exchanges code for access token
  ↓
Stores token (TODO: implement secure storage)
  ↓
Redirects to success page
```

### 3. OAuth Callback Page
**Path:** `/leadconnector/oauth` (GET)  
**File:** `src/app/leadconnector/oauth/page.tsx`

Simple page that displays OAuth callback status.

## OAuth Token Exchange

The endpoint exchanges the authorization code for an access token using:
- **Token URL:** `https://api.gohighlevel.com/oauth/token`
- **Grant Type:** `authorization_code`
- **Redirect URI:** Matches the configured redirect URLs

## Next Steps

1. ✅ OAuth credentials added to `.env.local`
2. ✅ OAuth callback endpoint created
3. ⏳ **TODO:** Implement secure token storage (database table for OAuth tokens)
4. ⏳ **TODO:** Handle token refresh
5. ⏳ **TODO:** Use OAuth tokens for API calls (if needed)

## Token Storage (Future Enhancement)

Currently, tokens are logged but not stored. To implement secure storage:

1. Create database table for OAuth tokens:
   ```sql
   CREATE TABLE oauth_tokens (
     id UUID PRIMARY KEY,
     location_id TEXT NOT NULL,
     access_token TEXT NOT NULL,
     refresh_token TEXT,
     expires_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. Store tokens after exchange
3. Use stored tokens for API calls
4. Implement token refresh logic

## Testing

Once the app is installed:
1. GHL will redirect to: `https://df-middleware.vercel.app/leadconnector/oauth?code=xxx`
2. Check logs for token exchange success
3. Verify redirect URL works correctly

---

**Status:** ✅ OAuth setup complete - ready for app installation!




