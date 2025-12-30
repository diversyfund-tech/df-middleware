# Get GHL Conversation Provider ID

## Quick Method: Use curl directly

Run this command (replace `YOUR_PIT_TOKEN` with your `GHL_API_KEY`):

```bash
curl -X GET "https://services.leadconnectorhq.com/conversations/providers?locationId=CTaxuyy2bMObvSaBQRxY" \
  -H "Authorization: Bearer pit-f92bd6cb-74ef-4499-84f8-3a620f68ad99" \
  -H "Accept: application/json" \
  -H "Version: 2021-07-28" | jq '.providers[] | select(.type == "SMS")'
```

Or to see all providers:

```bash
curl -X GET "https://services.leadconnectorhq.com/conversations/providers?locationId=CTaxuyy2bMObvSaBQRxY" \
  -H "Authorization: Bearer pit-f92bd6cb-74ef-4499-84f8-3a620f68ad99" \
  -H "Accept: application/json" \
  -H "Version: 2021-07-28" | jq '.'
```

## Alternative: Use the test endpoint

If the endpoint works, you can also use:

```bash
curl http://localhost:3000/api/test/get-ghl-providers | jq '.recommendedProvider.id'
```

## What to look for

In the response, find the provider that matches your Marketplace App name (e.g., "DF Middleware" or similar).

Example response:
```json
{
  "providers": [
    {
      "id": "convprov_8f3a9c1d2e",
      "name": "DF Middleware (Telnyx)",
      "type": "SMS",
      "isDefault": false
    }
  ]
}
```

The `id` field is your `conversationProviderId`.

## Add to .env.local

Once you have the ID, add it:

```bash
GHL_CONVERSATION_PROVIDER_ID=convprov_8f3a9c1d2e
```

## Note

If the endpoint returns an error, it might be that:
1. The provider hasn't been fully created yet
2. The endpoint path is different
3. We need to use OAuth token instead of PIT

Let me know what the curl command returns and I can help debug further!

