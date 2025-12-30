# Provider Configuration Issue

## Current Error
```
400: Incorrect conversationProviderId/type
```

## Provider Configuration (from screenshots)
- ✅ Name: "DF Middleware (Telnyx)"
- ✅ Type: "SMS" (dropdown, uppercase)
- ✅ Delivery URL: Set correctly
- ⚠️ **"Is this a Custom Conversation Provider?" - UNCHECKED**

## What We're Sending
- `conversationProviderId`: `695403c62238096934880f15` ✅ (verified)
- `type`: `"SMS"` ✅ (matches provider type)
- `locationId`: `CTaxuyy2bMObvSaBQRxY` ✅
- `contactId`: Valid contact ID ✅
- `message`: Message text ✅
- `phone`: Phone number ✅
- `dateSent`: ISO timestamp ✅

## Possible Issues

### 1. Custom Conversation Provider Checkbox
The "Is this a Custom Conversation Provider?" checkbox is **unchecked**. This might affect how the API validates the provider.

**Try:** Check the "Is this a Custom Conversation Provider?" checkbox in the Marketplace App provider configuration.

### 2. Provider Type Mismatch
Even though the provider type shows as "SMS", GHL might be expecting a different format or value internally.

**Possible values to try:**
- `"SMS"` (current)
- `"sms"` (lowercase)
- Provider-specific identifier

### 3. Provider Not Fully Activated
The provider might need to be "activated" or have additional configuration before it can be used for imports.

## Next Steps

1. **Check "Is this a Custom Conversation Provider?" checkbox** in the Marketplace App
2. Save the provider configuration
3. Retry the import

If that doesn't work, we may need to:
- Verify the provider is fully installed/activated for the location
- Check if there are any additional provider settings needed
- Contact GHL support about the exact error message

