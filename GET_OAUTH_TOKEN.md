# How to Get Your MCP OAuth Token for Testing

The test script needs your OAuth token to authenticate with the Google Workspace MCP server.

## Method 1: From Browser localStorage (Recommended)

1. Open your app in the browser: https://openai-realtime-agents-production-7953.up.railway.app
2. Open the MCP Servers modal and ensure you're authorized (shows "connected")
3. Open DevTools (F12 or Cmd+Option+I)
4. Go to the **Application** tab
5. In the left sidebar, expand **Local Storage** → `https://openai-realtime-agents-production-7953.up.railway.app`
6. Look for a key that starts with `mcp_oauth_state_` or similar
7. Copy the value (it's a JWT token starting with `eyJ...`)

## Method 2: From Network Tab

1. Open your app in the browser
2. Open DevTools → **Network** tab
3. Click "Authorize Google Workspace" in the MCP modal
4. Look for the POST request to `/api/mcp/oauth/token`
5. Click on it and view the **Response** tab
6. Copy the `access_token` value

## Run the Test

Once you have the token, run:

```bash
MCP_OAUTH_TOKEN="your_token_here" npx tsx scripts/test-mcp-direct.ts
```

## What This Test Will Do

1. ✅ Connect to the MCP server (verified working)
2. ✅ List available tools to confirm `create_event` exists
3. 🧪 Call `create_event` with proper RFC3339 timezone format
4. 📊 Show the exact response from the server

This will tell us if the MCP server itself works correctly when given proper arguments, independent of the OpenAI Realtime API approval flow.
