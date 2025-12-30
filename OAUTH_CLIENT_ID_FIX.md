# OAuth Client ID Error Fix

## Error
```
"Invalid parameter: `client_id`"
```

## Possible Causes

1. **Environment variable not accessible** - Vercel might not have the variable available at runtime
2. **Whitespace/newlines** - Variable might have trailing characters
3. **Variable not set for correct environment** - Might only be set for Preview, not Production
4. **Build-time vs Runtime** - Variable might not be available at request time

## Fixes Applied

1. ✅ Added `.trim()` to client ID and secret
2. ✅ Added better error logging to see what's being sent
3. ✅ Added logging to show client_id prefix (for debugging without exposing full value)

## Next Steps

1. **Wait for deployment** - Changes are pushed, wait for Vercel to deploy
2. **Check Vercel logs** - After re-installation attempt, check Vercel function logs for the debug output
3. **Verify variable format** - Make sure the client ID in Vercel matches exactly:
   - Should be: `6953d6aa4b770d0bf8434e1d-mjsthmxx`
   - No extra spaces, newlines, or quotes

## Verify in Vercel Dashboard

1. Go to: Vercel Dashboard → Project Settings → Environment Variables
2. Check `GHL_CLIENT_ID` value
3. Make sure it's set for **Production** environment
4. Value should be exactly: `6953d6aa4b770d0bf8434e1d-mjsthmxx` (no quotes, no spaces)

## After Deployment

Try the OAuth flow again. The new logging will show:
- Whether client_id is being read
- First 10 characters of client_id (for verification)
- Full redirect_uri being used

This will help identify if it's a variable access issue or a format issue.

