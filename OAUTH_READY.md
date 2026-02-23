# OAuth Setup - Ready to Test

## ✅ Configuration Complete

### Redirect URIs Configured in GHL Marketplace App
- ✅ `https://df-middleware.vercel.app/leadconnector/oauth` (Production)
- ✅ `http://localhost:3000/leadconnector/oauth` (Local)

### Environment Variables Set in Vercel Production
- ✅ `GHL_CLIENT_ID` = `6953d6aa4b770d0bf8434e1d-mjsthmxx`
- ✅ `GHL_CLIENT_SECRET` = (encrypted)
- ✅ `GHL_CONVERSATION_PROVIDER_ID` = `695403c62238096934880f15`

### Code Deployed
- ✅ OAuth callback handler with trimming
- ✅ Enhanced error logging
- ✅ Token storage in database
- ✅ Automatic token refresh

## Next Steps

### 1. Test OAuth Installation
1. Go to GHL Marketplace App installation page
2. Click "Install" or "Re-authorize"
3. You'll be redirected to: `https://df-middleware.vercel.app/leadconnector/oauth?code=...`
4. The callback will:
   - Exchange code for access token
   - Store tokens in production database
   - Return success response

### 2. Expected Success Response
```json
{
  "success": true,
  "message": "OAuth authorization successful",
  "locationId": "CTaxuyy2bMObvSaBQRxY"
}
```

### 3. Verify Tokens Stored
After successful OAuth, test the import:
```bash
curl -X POST https://df-middleware.vercel.app/api/test/import-verity-conversations \
  -H "Content-Type: application/json" \
  -d '{"chatMessageId": "09550cc3-231e-4daa-9c5c-7450e4da4eca"}'
```

### 4. Check Vercel Logs
If there are any issues, check Vercel function logs for:
- `[ghl.oauth] Token exchange params:` - Shows redirect_uri and client_id prefix
- `[ghl.oauth] Redirect URI:` - Shows exact redirect URI being sent
- Any error messages with details

## Troubleshooting

### If "Invalid parameter: `client_id`" persists:
1. Check Vercel logs for the exact `client_id` being sent
2. Verify it matches: `6953d6aa4b770d0bf8434e1d-mjsthmxx`
3. Ensure no extra spaces/newlines (code trims, but verify)

### If redirect URI mismatch:
1. Compare logs `redirect_uri` with GHL settings
2. Must match exactly (no trailing slash, correct protocol)

### If tokens not stored:
1. Check database connection in production
2. Verify `ghl_oauth_tokens` table exists
3. Check Vercel logs for storage errors

## Ready to Test! 🚀

All configuration is complete. Try the OAuth flow now!




