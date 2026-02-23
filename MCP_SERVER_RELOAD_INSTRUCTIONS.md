# MCP Server Reload Instructions

**Status:** ✅ Configuration Updated | ⏳ Waiting for Cursor to Reload MCP Server

## Configuration Status

The MCP server configuration has been updated in `~/.cursor/mcp.json`:

```json
{
  "df-middleware": {
    "command": "bun",
    "args": [
      "/Users/jaredlutz/Github/df-middleware/src/mcp/server.ts"
    ],
    "env": {
      "VERITY_BASE_URL": "http://localhost:3000",
      "VERITY_CATALOG_PATH": "/Users/jaredlutz/Github/verity/docs/df-middleware/api-catalog.json",
      "CLERK_SECRET_KEY": "sk_test_bK2Mt5naoQmZp07f869F7GXkRAYvWOPG8kA7JWDY33"
    }
  }
}
```

## To Reload MCP Server in Cursor

The MCP server needs to be reloaded to pick up the new `CLERK_SECRET_KEY` environment variable. Try one of these methods:

### Option 1: Reload Cursor Window
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Reload Window"
3. Select "Developer: Reload Window"

### Option 2: Restart Cursor Completely
1. Quit Cursor completely
2. Reopen Cursor
3. The MCP server will automatically restart with new config

### Option 3: Check MCP Server Status
1. Open Cursor Settings
2. Go to "Tools and MCP" or "MCP Servers"
3. Look for "df-middleware" server status
4. If there's a reload/restart option, use it

## Verification

After reloading, test the MCP server:

```
Use Verity API to initiate an AI call to Jared Lutz at +19492459055
```

If successful, you should see:
- ✅ Clerk token generated
- ✅ Request sent to Verity API
- ✅ Call initiated successfully

If you still see "CLERK_SECRET_KEY is not configured", the MCP server hasn't reloaded yet. Try restarting Cursor completely.

## Current Implementation Status

✅ **Code Implementation:** Complete
- Clerk token manager created
- MCP server updated to use Clerk tokens
- Error handling and retry logic implemented
- Environment validation updated

✅ **Configuration:** Complete
- MCP config file updated with CLERK_SECRET_KEY
- Environment variables properly configured

⏳ **Runtime:** Waiting for Cursor to reload MCP server

## Troubleshooting

If the MCP server still doesn't pick up the environment variable:

1. **Check Cursor Logs:**
   - Look for MCP server startup messages
   - Verify environment variables are being passed

2. **Manual Test:**
   ```bash
   cd /Users/jaredlutz/Github/df-middleware
   CLERK_SECRET_KEY=sk_test_bK2Mt5naoQmZp07f869F7GXkRAYvWOPG8kA7JWDY33 \
   VERITY_BASE_URL=http://localhost:3000 \
   bun run src/mcp/server.ts
   ```
   This should start the server and show it loading the catalog.

3. **Verify Verity is Running:**
   ```bash
   curl http://localhost:3000/health
   ```
   Should return a response (even if 404, means server is running)
