# MCP Direct Test Results

## Summary

I created a direct test script (`test-mcp-direct.ts`) that bypasses the OpenAI Realtime API and calls the Google Workspace MCP server directly using the MCP SDK.

## Test Script Created

**Location:** `/Users/stevekelly/myApps/orbyRealtime/test-mcp-direct.ts`

This script:
1. Connects to the MCP server using the same SDK your app uses
2. Lists available tools to verify `create_event` exists
3. Calls `create_event` with proper RFC3339 timezone format
4. Shows the exact response from the server

## Initial Test Results (Without OAuth Token)

### Test 1: Wrong URL
```
URL: https://googleworkspacemcp-production.up.railway.app
Result: ❌ HTTP 404 Not Found
```

### Test 2: Correct URL (with `/mcp` endpoint)
```
URL: https://googleworkspacemcp-production.up.railway.app/mcp
Result: ✅ HTTP 401 Authentication Required
Error: {"error": "invalid_token", "error_description": "Authentication required"}
```

## Key Findings

✅ **MCP Server is Running**: The server responds correctly at `/mcp` endpoint

✅ **Authentication is Working**: Server properly rejects unauthenticated requests

✅ **URL Format is Correct**: The `/mcp` suffix is required (as configured in `mcpCatalog.ts`)

🔐 **OAuth Token Required**: Need a valid token to test tool execution

## Next Steps

### For You (User):

1. **Get your OAuth token** - See `GET_OAUTH_TOKEN.md` for instructions
2. **Run the test** with your token:
   ```bash
   MCP_OAUTH_TOKEN="your_token_here" npx tsx test-mcp-direct.ts
   ```

This will show us:
- Does the MCP server accept RFC3339 timestamps with timezone?
- What response format does it return?
- Are there any server-side errors?

### What This Will Prove

If the direct test succeeds, we'll know:
- ✅ The MCP server works correctly
- ✅ Our RFC3339 format is valid
- ❌ The problem is in the OpenAI → MCP approval flow (not the server itself)

If the direct test fails:
- We'll see the exact error from Google's Calendar API
- We can debug the argument format
- We'll have MCP server logs showing what went wrong

## Current Issue Context

Your app shows:
```json
{
  "type": "agent.mcp_call.initiated",
  "mcp_call_id": "item_...",
  "tool_name": "create_event",
  "arguments": {
    "summary": "Test standup meeting",
    "start_time": "2025-10-21T16:00:00+11:00",  // ✅ Correct format
    "end_time": "2025-10-21T17:00:00+11:00",    // ✅ Correct format
    "description": "Test description"
  }
}
```

But then:
```json
{
  "type": "agent.mcp_call.completed",
  "output": null,
  "error": null,
  "status": "abandoned"
}
```

With `approval_request_id: null` - meaning OpenAI never created an approval request.

## Debugging Theory

I suspect one of these scenarios:

**Scenario A: Session Configuration Issue**
- The MCP server config sent to OpenAI during session creation might be incomplete
- Missing `approval_required: true` or similar field
- OpenAI skips approval and tries to execute, but fails silently

**Scenario B: OpenAI API Bug**
- The Realtime API has a bug with MCP approval flow
- Some calls get approval requests, others don't (as we saw in logs)
- This is outside our control

**Scenario C: Server Response Format**
- MCP server might be returning data in a format OpenAI doesn't expect
- This causes OpenAI to abandon the call without creating approval
- Direct testing will reveal this

## Test Output Will Show

When you run the test with your OAuth token, you'll see one of:

### Success Case:
```
✓ Tool call completed!
Response: {
  "content": [{
    "type": "text",
    "text": "Event created: https://calendar.google.com/event?eid=..."
  }],
  "isError": false
}
✅ SUCCESS: Event created successfully!
```

### Error Case:
```
Response: {
  "content": [{
    "type": "text",
    "text": "Error: Invalid timezone format"
  }],
  "isError": true
}
```

This will tell us EXACTLY what the MCP server expects and returns.

## Railway Logs

To see server-side logs during the test:
```bash
# In the Railway web dashboard
# https://railway.app/project/2daab0e5-db69-4152-a595-23af33325731

# Or via CLI (need to select service first):
railway link -p 2daab0e5-db69-4152-a595-23af33325731
railway logs --follow
```

The CLI requires interactive selection which isn't available here, so use the web dashboard.
