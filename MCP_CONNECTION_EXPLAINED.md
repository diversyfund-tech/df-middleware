# MCP Server Connection to Verity - Explained

## How the MCP Server Connects to Verity

### ✅ **Connected, but NOT "Trained"**

The MCP server is **connected** to Verity, but it's important to understand how:

### Architecture

```
Cursor Chat
    ↓
MCP Server (stdio protocol)
    ↓
Loads API Catalog JSON file
    ↓
Generates 306 tools dynamically
    ↓
Makes HTTP requests to Verity API
    ↓
Verity API (localhost:3000)
```

### Connection Method

1. **API Catalog** (Not Codebase Access)
   - Loads: `/Users/jaredlutz/Github/verity/docs/df-middleware/api-catalog.json`
   - This is a JSON file that **describes** Verity's API endpoints
   - Contains: endpoint paths, HTTP methods, parameters, descriptions
   - **324 endpoints** cataloged → **306 tools** generated

2. **HTTP API Calls** (Not Direct Code Access)
   - Makes HTTP requests to `http://localhost:3000`
   - Uses standard REST API calls
   - Authenticates with `VERITY_API_KEY` (Bearer token)
   - Does NOT have direct access to Verity's codebase

3. **Dynamic Tool Generation**
   - Reads the catalog JSON
   - Generates MCP tools automatically
   - No manual tool definitions needed
   - Tools follow pattern: `domain_resource_action`

### What "Connected" Means

✅ **Connected:**
- Can make HTTP requests to Verity API
- Knows about all 324 endpoints from catalog
- Can call any Verity API endpoint
- Has authentication configured

❌ **NOT Connected:**
- Does NOT have direct codebase access
- Does NOT read Verity source code
- Does NOT have "training" on Verity's code
- Does NOT understand Verity's internal logic

### Authentication Fix Applied

**Issue Found:** MCP server wasn't sending authentication
**Fix Applied:**
- ✅ Added `VERITY_API_KEY` reading in MCP server
- ✅ Passes API key as `authToken` to proxy
- ✅ Updated Cursor MCP config with `VERITY_API_KEY`

### Current Status

**MCP Server:** ✅ Working correctly
- Loads catalog ✅
- Generates tools ✅
- Routes requests ✅
- **Now includes authentication** ✅

**Verity API:** ⚠️ Endpoint returning 404
- `/apicalls/agents/{agentId}/test` endpoint not found
- Possible reasons:
  1. Endpoint doesn't exist in local dev
  2. Need valid agent ID (not "test")
  3. Route structure different in dev vs production

### To Test Successfully

You'll need to:
1. **Restart Cursor** (to load new MCP config with API key)
2. **Find valid agent ID** - try listing agents first:
   ```
   Use Verity API to list all agents
   ```
3. **Use correct endpoint** - the catalog shows the endpoint exists, but it might need proper setup

### Summary

- ✅ MCP server IS connected to Verity (via HTTP API)
- ✅ MCP server IS configured with authentication
- ✅ MCP server CAN call any Verity endpoint from catalog
- ⚠️ The specific endpoint might not be available or needs proper setup
- ❌ MCP server does NOT have direct codebase access (it's an API client, not a code reader)

The MCP server works like a smart API client - it knows what endpoints exist (from catalog) and can call them, but it doesn't have direct access to Verity's codebase.
