# Redirect URI Format Check

## Expected Redirect URI
**Production:** `https://df-middleware.vercel.app/leadconnector/oauth`

## Code Implementation
The code constructs the redirect URI as:
```typescript
redirect_uri: (req.nextUrl.origin + "/leadconnector/oauth").trim()
```

Where `req.nextUrl.origin` should be:
- Production: `https://df-middleware.vercel.app`
- Local: `http://localhost:3000`

## Common OAuth Redirect URI Issues

### 1. Exact Match Required
OAuth2 requires the redirect URI to **exactly match** what's configured in the app settings. Common mismatches:
- ❌ Trailing slash: `https://df-middleware.vercel.app/leadconnector/oauth/`
- ✅ Correct: `https://df-middleware.vercel.app/leadconnector/oauth`
- ❌ Protocol mismatch: `http://` vs `https://`
- ❌ Port mismatch: `:3000` vs no port
- ❌ Query parameters: `?code=...` (should not be included in token exchange)

### 2. GHL Marketplace App Configuration
In the GHL Marketplace App settings, the redirect URLs should be:
- `http://localhost:3000/leadconnector/oauth` (for local dev)
- `https://df-middleware.vercel.app/leadconnector/oauth` (for production)

**Important:** Both URLs must be registered, and the one used during OAuth flow must match exactly.

### 3. Current Code Behavior
The code uses `req.nextUrl.origin` which:
- ✅ Automatically uses correct protocol (http/https)
- ✅ Automatically uses correct hostname
- ✅ Automatically uses correct port (if any)
- ✅ Does NOT include query parameters
- ✅ Does NOT include trailing slash

## Verification Steps

1. **Check GHL Marketplace App Settings:**
   - Go to Marketplace App → Settings → Redirect URLs
   - Verify both URLs are listed:
     - `http://localhost:3000/leadconnector/oauth`
     - `https://df-middleware.vercel.app/leadconnector/oauth`

2. **Check Vercel Logs:**
   After OAuth attempt, check logs for:
   ```
   [ghl.oauth] Redirect URI: https://df-middleware.vercel.app/leadconnector/oauth
   ```
   This should match exactly what's in GHL settings.

3. **Common Issues:**
   - If redirect URI doesn't match → GHL will reject with "redirect_uri_mismatch"
   - If client_id is invalid → GHL will reject with "Invalid parameter: client_id"
   - If client_secret is invalid → GHL will reject with "invalid_client"

## Debugging

If you see "Invalid parameter: `client_id`", it could be:
1. Client ID is empty/undefined (check Vercel env vars)
2. Client ID has whitespace/newlines (`.trim()` should fix this)
3. Client ID format is wrong (should be: `6953d6aa4b770d0bf8434e1d-mjsthmxx`)

The enhanced logging will show:
- First 10 chars of client_id
- Full redirect_uri being sent
- Whether variables are being read

