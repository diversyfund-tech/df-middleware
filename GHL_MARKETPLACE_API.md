# GHL Marketplace API - MCP Availability

## Answer: No Marketplace API in GHL MCP

The GHL MCP (Model Context Protocol) server **does not** include marketplace/developer API functions for creating or managing apps.

## What GHL MCP Provides

The GHL MCP server includes functions for:

### Available APIs
- ✅ **Contacts API** - Create, update, get contacts
- ✅ **Conversations API** - Send messages, get conversations
- ✅ **Calendars API** - Get calendar events, appointments
- ✅ **Locations API** - Get location details, custom fields
- ✅ **Opportunities API** - Manage opportunities, pipelines
- ✅ **Payments API** - List transactions, get orders
- ✅ **Social Media Posting API** - Create/edit posts
- ✅ **Blogs API** - Manage blog posts, categories, authors
- ✅ **Emails API** - Create/fetch email templates

### Not Available
- ❌ **Marketplace API** - No app creation/management
- ❌ **Developer API** - No developer portal functions
- ❌ **Provider Management** - No conversation provider creation
- ❌ **App Installation** - No installation management

## How to Create Marketplace App

Since the MCP doesn't have marketplace APIs, you'll need to:

### Option 1: GHL Developer Portal (Web UI)
1. Go to https://marketplace.gohighlevel.com/developer
2. Create a new app
3. Add a Conversation Provider (SMS type)
4. Configure the provider settings
5. Get the `conversationProviderId` from the provider

### Option 2: Direct API Calls (if available)
Check GHL's developer documentation for marketplace API endpoints:
- May require different authentication (OAuth vs PIT)
- May have separate API base URL
- Check: https://marketplace.gohighlevel.com/docs

### Option 3: Manual Setup
1. Use the web UI to create the app
2. Copy the `conversationProviderId` from the provider settings
3. Add it to your environment variables

## Recommendation

**Use the GHL Developer Portal web UI** to create your marketplace app:
- Most straightforward approach
- Visual interface for configuration
- Immediate access to provider IDs
- No API authentication complexity

Once you have the `conversationProviderId`, add it to your `.env.local`:
```bash
GHL_CONVERSATION_PROVIDER_ID=your_provider_id_here
```

## Next Steps

1. ✅ Code is ready (we've implemented the import endpoints)
2. ⏳ Create marketplace app via web UI
3. ⏳ Get `conversationProviderId`
4. ⏳ Add to environment variables
5. ⏳ Test import functionality

---

**Note:** The GHL MCP is designed for standard GHL API operations (contacts, conversations, etc.), not for marketplace/developer operations. Those require the Developer Portal web interface.

