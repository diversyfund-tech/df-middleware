# Verity Environment Variables Setup

**Date:** December 26, 2024

## Summary

The API key is a **shared secret** between Verity and DF Middleware - it's not from an external service. Both systems need to use the same value for authentication.

## Values Generated

All secrets have been generated and are ready to use:

- **API Key:** `622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c`
- **Webhook Secret:** `8e3d9345c580e8069f981a78663f9214f136e3082cbf75b7d388feebf38e8fac`

## DF Middleware (.env.local) ✅

Already configured with:
- `VERITY_BASE_URL=https://verity.diversyfund.com`
- `VERITY_API_KEY=622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c`
- `VERITY_WEBHOOK_SECRET=8e3d9345c580e8069f981a78663f9214f136e3082cbf75b7d388feebf38e8fac`

## Verity Environment Variables Needed

Add these to Verity's environment (Doppler or `.env.local`):

```bash
# DF Middleware Integration
DF_MIDDLEWARE_WEBHOOK_URL=https://df-middleware.vercel.app/api/webhooks/texting
DF_MIDDLEWARE_WEBHOOK_SECRET=8e3d9345c580e8069f981a78663f9214f136e3082cbf75b7d388feebf38e8fac
DF_MIDDLEWARE_API_KEY=622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c
```

## How It Works

1. **API Key Authentication:**
   - Middleware sends `Authorization: Bearer <VERITY_API_KEY>` header when calling Verity's send-message endpoint
   - Verity validates this matches `DF_MIDDLEWARE_API_KEY`
   - This is a simple shared secret - no external service needed

2. **Webhook Secret:**
   - Verity forwards webhooks to middleware with `X-Texting-Secret: <DF_MIDDLEWARE_WEBHOOK_SECRET>` header
   - Middleware validates this matches `VERITY_WEBHOOK_SECRET`
   - Ensures webhooks are actually coming from Verity

## Next Steps

1. ✅ DF Middleware `.env.local` is configured
2. ⏳ Add the 3 environment variables above to Verity
3. ⏳ Deploy both systems
4. ⏳ Test the integration

## Testing

Once both systems are configured, test with:

```bash
# Test sending a message via Verity API (from middleware)
curl -X POST https://verity.diversyfund.com/api/integrations/df-middleware/send-message \
  -H "Authorization: Bearer 622d96d71affe1ec1185903ce26afc2ceed8f43a50a1286714d3ae271f7ca66c" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "body": "Test message"
  }'
```

---

**All values are ready to use!** Just add them to Verity's environment and you're good to go.

