# MCP Calendar Event Creation - Testing Status

## What I've Done

Created a direct test script to bypass the OpenAI Realtime API and test the Google Workspace MCP server independently.

### Files Created

1. **`test-mcp-direct.ts`** - Direct MCP server test using the MCP SDK
2. **`GET_OAUTH_TOKEN.md`** - Instructions for extracting your OAuth token
3. **`MCP_DIRECT_TEST_RESULTS.md`** - Detailed test results and analysis

## Test Results So Far

### ✅ Successful Discoveries

1. **MCP Server is Running**
   - URL: `https://googleworkspacemcp-production.up.railway.app/mcp`
   - Server responds correctly to requests
   - Authentication layer is working (returns 401 without token)

2. **URL Format Verified**
   - The `/mcp` endpoint suffix is required
   - This matches your app configuration in `mcpCatalog.ts`

3. **SDK Connection Works**
   - The `StreamableHTTPClientTransport` successfully connects
   - Same SDK your app uses, so this proves the transport layer works

### 🔐 Next Step Required: OAuth Token

The test needs your OAuth token to proceed. Without it, we get:
```
Error: HTTP 401 - Authentication required
```

## How to Continue Testing

### Step 1: Get Your OAuth Token

Follow instructions in `GET_OAUTH_TOKEN.md`:

**Quick method:**
1. Open your deployed app: https://openai-realtime-agents-production-7953.up.railway.app
2. Open DevTools (F12) → Application tab → Local Storage
3. Look for keys related to `mcp_oauth_state_` or similar
4. Copy the token value

**Alternative - Network tab:**
1. Open DevTools → Network tab
2. Click "Authorize Google Workspace" in MCP modal
3. Find the POST to `/api/mcp/oauth/token`
4. Copy the `access_token` from the response

### Step 2: Run the Test

```bash
cd /Users/stevekelly/myApps/orbyRealtime
MCP_OAUTH_TOKEN="your_token_here" npx tsx test-mcp-direct.ts
```

### Step 3: What the Test Will Show

The test will:
1. ✅ Connect to MCP server with your auth token
2. ✅ List all available tools (verify `create_event` exists)
3. 🧪 Call `create_event` with these arguments:
   ```json
   {
     "summary": "MCP Test Event - Direct Call",
     "start_time": "2025-10-22T09:00:00+11:00",
     "end_time": "2025-10-22T10:00:00+11:00",
     "description": "Test event created via direct MCP SDK call to verify RFC3339 format works"
   }
   ```
4. 📊 Show the exact response from the server

## What This Will Prove

### If the test SUCCEEDS (creates an event):

✅ **MCP server works correctly**
✅ **RFC3339 timezone format is valid**
✅ **OAuth authentication is working**
❌ **Problem is in the OpenAI Realtime API approval flow**

This means:
- The MCP server itself is fine
- Your arguments format is correct
- The issue is that OpenAI isn't creating approval requests (`approval_request_id: null`)
- We need to investigate the session configuration or OpenAI API behavior

### If the test FAILS:

We'll see the EXACT error from Google Calendar API, such as:
- "Invalid timezone format" → Need to adjust format
- "Invalid OAuth token" → Token expired/invalid
- "Calendar API disabled" → Google Cloud Console issue
- Server error → MCP server bug

## Current Problem Summary

Your app shows this sequence:
1. ✅ MCP call initiated with correct arguments (timezone included)
2. ❌ No approval request created (`approval_request_id: null`)
3. ❌ Call abandoned with `output: null, error: null`

This is different from the earlier test where:
- An approval request WAS created but arrived too late (after `response.done`)

The fact that no approval is being created at all suggests either:
- Session configuration issue
- OpenAI API behavioral change
- MCP server metadata issue

## Railway Logs

To check server-side activity while testing:

1. **Web Dashboard** (easier):
   - Visit: https://railway.app/project/2daab0e5-db69-4152-a595-23af33325731
   - Click on the service
   - Go to "Deployments" → "Logs"
   - Watch for activity when you run the test

2. **CLI** (requires manual service selection):
   ```bash
   railway link -p 2daab0e5-db69-4152-a595-23af33325731
   railway logs --follow
   ```
   Note: CLI requires interactive terminal for service selection

## What to Look For in Logs

When you run the direct test, Railway logs should show:
- `[create_event]` - Tool execution attempt
- Google API request/response
- Any Python exceptions or stack traces
- Token validation messages

If logs are silent when you run the test → MCP server crashed before logging

## Summary

I've created a test that will definitively show whether the MCP server works with your arguments. Once you run it with your OAuth token, we'll know:

1. Does the server accept RFC3339 with timezone?
2. What response format does it return?
3. Are there any Google API errors?

This will separate "MCP server issues" from "OpenAI approval flow issues" and give us a clear path forward.

**Next action:** Get your OAuth token and run the test!
