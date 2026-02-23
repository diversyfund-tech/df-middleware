# MCP Server Local Testing Setup - Complete ✅

**Date:** 2026-01-22  
**Status:** ✅ **READY FOR TESTING**

## Setup Complete

All prerequisites have been verified and configured:

### ✅ Prerequisites Verified

1. **Dependencies Installed**
   - `@modelcontextprotocol/sdk@1.25.3` ✅
   - `express@4.22.1` ✅
   - `@clerk/backend@1.34.0` ✅
   - All dependencies installed successfully

2. **API Catalog**
   - Location: `/Users/jaredlutz/Github/verity/docs/df-middleware/api-catalog.json` ✅
   - Endpoints: **324 endpoints** cataloged
   - Tools Generated: **306 tools** from catalog

3. **Verity API**
   - Running on: `http://localhost:3000` ✅
   - Status: Server responding (Next.js app running)

4. **MCP Configuration**
   - Cursor config updated: `~/.cursor/mcp.json` ✅
   - Server configured with correct paths and environment variables

## MCP Server Configuration

The MCP server has been added to your Cursor configuration:

```json
{
  "mcpServers": {
    "df-middleware": {
      "command": "bun",
      "args": [
        "/Users/jaredlutz/Github/df-middleware/src/mcp/server.ts"
      ],
      "env": {
        "VERITY_BASE_URL": "http://localhost:3000",
        "VERITY_CATALOG_PATH": "/Users/jaredlutz/Github/verity/docs/df-middleware/api-catalog.json"
      }
    }
  }
}
```

## Testing the MCP Server

### Step 1: Restart Cursor

**IMPORTANT:** You must restart Cursor for the MCP configuration to take effect.

1. Quit Cursor completely (⌘Q on Mac)
2. Reopen Cursor
3. The MCP server will automatically start when Cursor loads

### Step 2: Verify MCP Server is Running

After restarting Cursor, check the MCP server status:

1. Open Cursor Settings → Tools and MCP
2. Look for "df-middleware" in the list
3. It should show as "Connected" or "Running"

### Step 3: Test in Cursor Chat

Try asking Cursor to use Verity API tools:

**Example 1: List available tools**
```
What Verity API tools are available?
```

**Example 2: Call a Verity endpoint**
```
Call the Verity API to list broadcasts
```

**Example 3: Get specific data**
```
Use Verity API to get information about broadcasts
```

## Manual Testing (Optional)

If you want to test the MCP server manually:

```bash
cd /Users/jaredlutz/Github/df-middleware

# Start MCP server (will run on stdio)
VERITY_BASE_URL=http://localhost:3000 \
VERITY_CATALOG_PATH=/Users/jaredlutz/Github/verity/docs/df-middleware/api-catalog.json \
bun run src/mcp/server.ts
```

Expected output:
```
[mcp-server] Loading API catalog...
[registry] Loaded API catalog: 324 endpoints
[mcp-server] Generating tools from 324 endpoints...
[mcp-server] Generated 306 tools
DF-Middleware MCP server v1.0.0 running on stdio
```

## Architecture

```
Cursor Chat → MCP Client → MCP Server (stdio) → API Gateway → Verity API (localhost:3000)
```

## Available Tools

The MCP server exposes **306 tools** generated from **324 Verity API endpoints**:

- Tool naming pattern: `domain_resource_action`
- Examples:
  - `comms_broadcasts_list` - List broadcasts
  - `comms_broadcasts_get` - Get specific broadcast
  - `calls_summarize-recent_get` - Get call summaries

## Troubleshooting

### MCP Server Not Connecting

1. **Check Cursor was restarted**
   - MCP config only loads on startup
   - Quit and reopen Cursor

2. **Check Verity is Running**
   ```bash
   curl http://localhost:3000
   ```
   Should return HTML (Next.js app)

3. **Check API Catalog Exists**
   ```bash
   test -f /Users/jaredlutz/Github/verity/docs/df-middleware/api-catalog.json && echo "Found" || echo "Missing"
   ```

4. **Check Bun is Installed**
   ```bash
   bun --version
   ```
   Should show version (currently: 1.2.13)

### MCP Server Errors

If you see errors in Cursor's MCP logs:

1. **"Cannot find module"**
   - Run: `cd /Users/jaredlutz/Github/df-middleware && bun install`

2. **"Failed to load API catalog"**
   - Verify catalog path exists
   - Check `VERITY_CATALOG_PATH` environment variable

3. **"Connection refused" to Verity**
   - Ensure Verity is running: `curl http://localhost:3000`
   - Check `VERITY_BASE_URL` is correct

## Next Steps

1. ✅ **Restart Cursor** to load MCP configuration
2. ✅ **Test in Cursor Chat** by asking about Verity API tools
3. ✅ **Verify tools work** by calling actual Verity endpoints
4. ⏳ **Complete Clerk authentication** (currently placeholder)
5. ⏳ **Add tests** for MCP server functionality

## Summary

- ✅ Dependencies installed
- ✅ API catalog loaded (324 endpoints → 306 tools)
- ✅ Verity API accessible (localhost:3000)
- ✅ MCP configuration updated
- ✅ Ready for testing

**Action Required:** Restart Cursor to activate the MCP server!
