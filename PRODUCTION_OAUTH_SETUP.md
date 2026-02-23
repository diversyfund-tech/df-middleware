# Production OAuth Setup

## Current Status
- ✅ Environment variables added to Vercel
- ✅ Code deployed to production
- ❌ OAuth tokens not stored in production database

## Issue
The OAuth tokens were stored in your local database, but production has a separate database. You need to re-install the Marketplace App in production to store the tokens.

## Steps to Fix

### 1. Verify OAuth Redirect URL in Marketplace App
Make sure the redirect URL includes production:
- `https://df-middleware.vercel.app/leadconnector/oauth`

### 2. Re-install Marketplace App
1. Go to GHL Marketplace App settings
2. Find your app in the installed apps
3. Click "Re-install" or "Re-authorize"
4. OR go to: `https://app.gohighlevel.com/v2/location/CTaxuyy2bMObvSaBQRxY/integration/6953d6aa4b770d0bf8434e1d`
5. Click "Re-authorize" or similar button

### 3. OAuth Flow
- You'll be redirected to: `https://df-middleware.vercel.app/leadconnector/oauth?code=...`
- The callback will exchange the code for tokens
- Tokens will be stored in the production database
- You should see: `{"success":true,"message":"OAuth authorization successful","locationId":"CTaxuyy2bMObvSaBQRxY"}`

### 4. Verify Tokens Stored
After installation, test the import:
```bash
curl -X POST https://df-middleware.vercel.app/api/test/import-verity-conversations \
  -H "Content-Type: application/json" \
  -d '{"chatMessageId": "09550cc3-231e-4daa-9c5c-7450e4da4eca"}'
```

## OAuth Callback Endpoint
**Production:** `https://df-middleware.vercel.app/leadconnector/oauth`

This endpoint will:
1. Receive authorization code from GHL
2. Exchange code for access token
3. Store tokens in production database
4. Return success response

## After OAuth Installation
Once tokens are stored, the import should work! The error will change from "No OAuth token found" to either success or the provider validation error we were debugging.




