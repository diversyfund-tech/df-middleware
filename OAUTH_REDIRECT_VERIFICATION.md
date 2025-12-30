# OAuth Redirect URI Verification

## Current Configuration

### Redirect URI in Code
```typescript
redirect_uri: (req.nextUrl.origin + "/leadconnector/oauth").trim()
```

**Production:** `https://df-middleware.vercel.app/leadconnector/oauth`  
**Local:** `http://localhost:3000/leadconnector/oauth`

### Redirect URIs in GHL Marketplace App
These should be configured in your GHL Marketplace App settings:
- ✅ `http://localhost:3000/leadconnector/oauth`
- ✅ `https://df-middleware.vercel.app/leadconnector/oauth`

## Format Requirements

OAuth2 requires **exact match** between:
1. Redirect URI configured in GHL Marketplace App
2. Redirect URI sent during token exchange

### ✅ Correct Format
- `https://df-middleware.vercel.app/leadconnector/oauth` (no trailing slash)
- Protocol: `https://`
- No query parameters
- No trailing slash

### ❌ Common Mistakes
- `https://df-middleware.vercel.app/leadconnector/oauth/` (trailing slash)
- `http://df-middleware.vercel.app/leadconnector/oauth` (wrong protocol)
- `https://df-middleware.vercel.app/leadconnector/oauth?code=...` (includes query)

## Verification Checklist

1. **GHL Marketplace App Settings:**
   - [ ] Go to Marketplace App → Settings → Redirect URLs
   - [ ] Verify `https://df-middleware.vercel.app/leadconnector/oauth` is listed
   - [ ] Verify `http://localhost:3000/leadconnector/oauth` is listed
   - [ ] Ensure NO trailing slashes
   - [ ] Ensure exact match (case-sensitive)

2. **Code Verification:**
   - [x] Code uses `req.nextUrl.origin` (auto-detects protocol/host)
   - [x] Code adds `/leadconnector/oauth` path
   - [x] Code trims whitespace
   - [x] Code does NOT include query parameters

3. **Environment Variables:**
   - [x] `GHL_CLIENT_ID` set in Vercel Production
   - [x] `GHL_CLIENT_SECRET` set in Vercel Production
   - [x] Values trimmed in code

## Debugging Steps

If OAuth fails with "Invalid parameter: `client_id`":

1. **Check Vercel Function Logs:**
   Look for:
   ```
   [ghl.oauth] Token exchange params: {
     client_id: "6953d6aa4b...",
     redirect_uri: "https://df-middleware.vercel.app/leadconnector/oauth"
   }
   ```

2. **Verify Redirect URI Match:**
   - Compare the `redirect_uri` in logs with GHL settings
   - Must be character-for-character identical

3. **Verify Client ID:**
   - Should be: `6953d6aa4b770d0bf8434e1d-mjsthmxx`
   - No extra spaces, newlines, or quotes
   - Code trims whitespace, but verify in logs

## Next Steps

1. Try OAuth flow again after deployment
2. Check Vercel function logs for the exact `redirect_uri` being sent
3. Compare with GHL Marketplace App settings
4. If mismatch found, update GHL settings to match exactly

