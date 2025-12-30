# GHL OAuth Scope Requirements for Conversation Providers

## Current Issue
Error: `400: Incorrect conversationProviderId/type`

## Possible Causes

### 1. Missing OAuth Scopes
The Marketplace App might need specific scopes to access conversation providers:
- `conversations.readonly` or `conversations.write`
- `conversations.messages.readonly` or `conversations.messages.write`
- Provider-specific scopes

### 2. Provider Not Fully Activated
Even though the provider exists, it might need to be:
- Fully installed/activated for the location
- Have all required permissions granted
- Be in an "active" state

### 3. Scope Mismatch
The OAuth token might not have the right scopes to use the provider, even though it was installed.

## Next Steps

1. **Check OAuth Scopes**: Verify what scopes were granted during installation
2. **Check Marketplace App Scopes**: Ensure the app requests conversation-related scopes
3. **Verify Provider Status**: Confirm the provider is active and accessible

## How to Check Scopes

The OAuth callback stores the `scope` field from the token response. Check the database:
```sql
SELECT scope FROM ghl_oauth_tokens WHERE location_id = 'CTaxuyy2bMObvSaBQRxY';
```

## Required Scopes (Likely)
- `conversations.write` - To create conversations and import messages
- `conversations.messages.write` - To import messages
- Provider-specific scope for custom conversation providers

