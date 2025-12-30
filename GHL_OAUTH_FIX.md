# GHL OAuth Fix - Token Exchange

## Issue
OAuth token exchange was failing with "Not found" error.

## Root Cause
1. **Wrong endpoint URL**: Was using `https://api.gohighlevel.com/oauth/token`
2. **Wrong content type**: Was using JSON, but OAuth2 standard uses form-encoded

## Fix Applied

### 1. Correct Token Endpoint
Changed from:
```
https://api.gohighlevel.com/oauth/token
```

To:
```
https://services.leadconnectorhq.com/oauth/token
```

This matches the GHL API base URL used elsewhere in the codebase.

### 2. Form-Encoded Request Body
Changed from JSON:
```json
{
  "client_id": "...",
  "client_secret": "...",
  "grant_type": "authorization_code",
  "code": "...",
  "redirect_uri": "..."
}
```

To form-encoded (OAuth2 standard):
```
client_id=...&client_secret=...&grant_type=authorization_code&code=...&redirect_uri=...
```

### 3. Correct Content-Type Header
Changed from:
```
Content-Type: application/json
```

To:
```
Content-Type: application/x-www-form-urlencoded
```

## Updated Code

```typescript
const tokenUrl = "https://services.leadconnectorhq.com/oauth/token";

const params = new URLSearchParams({
	client_id: clientId,
	client_secret: clientSecret,
	grant_type: "authorization_code",
	code: code,
	redirect_uri: req.nextUrl.origin + "/leadconnector/oauth",
});

const tokenResponse = await fetch(tokenUrl, {
	method: "POST",
	headers: {
		"Content-Type": "application/x-www-form-urlencoded",
		"Accept": "application/json",
	},
	body: params.toString(),
});
```

## Testing

After this fix, the OAuth flow should work:
1. User installs app → Redirected to GHL OAuth
2. User authorizes → Redirected back with code
3. Code exchange → Should now succeed
4. Access token received → Can be stored/used

## Next Steps

1. ✅ Fixed token endpoint URL
2. ✅ Fixed request format (form-encoded)
3. ⏳ Test OAuth flow again
4. ⏳ Verify token exchange succeeds
5. ⏳ Implement token storage (if needed)

---

**Status:** ✅ Fixed - Ready for testing

