# Quick Start: MCP Calendar Event Testing

## TL;DR

I created a test to check if the Google Workspace MCP server works independently of OpenAI's Realtime API.

**What you need to do:**

1. Get your OAuth token from the browser (see `GET_OAUTH_TOKEN.md`)
2. Run: `MCP_OAUTH_TOKEN="your_token" npx tsx test-mcp-direct.ts`
3. Share the output with me

This will tell us if the problem is with the MCP server or with OpenAI's approval flow.

---

## Files Created

| File | Purpose |
|------|---------|
| `test-mcp-direct.ts` | Test script that calls MCP server directly |
| `GET_OAUTH_TOKEN.md` | How to get your OAuth token from the browser |
| `MCP_DIRECT_TEST_RESULTS.md` | Initial test results (without token) |
| `TESTING_STATUS.md` | Comprehensive testing status and next steps |
| `README_MCP_TESTING.md` | This quick reference |

---

## Current Status

### ✅ What Works

- MCP server is running and responding
- URL format is correct (`/mcp` endpoint)
- Authentication layer works (rejects requests without token)
- SDK connection succeeds

### ❌ What's Blocked

- Need OAuth token to test actual tool execution
- Can't verify if `create_event` accepts our RFC3339 format
- Can't see exact error messages from Google Calendar API

---

## The Problem We're Solving

Your app shows:
```
MCP call initiated → Arguments sent with timezone → No approval request → Call abandoned
```

The approval request has `approval_request_id: null`, which means OpenAI isn't creating approval requests at all.

**Question:** Is the MCP server the problem, or is it OpenAI's approval flow?

**Answer:** Run the direct test to find out!

---

## Expected Outcomes

### If Test Succeeds ✅
- MCP server works fine
- RFC3339 format is correct
- Problem is in OpenAI's approval flow
- Next: Investigate session configuration

### If Test Fails ❌
- We'll see the exact Google API error
- Can fix the argument format
- Can debug OAuth/API issues
- Next: Fix the specific error shown

---

## Quick Command Reference

```bash
# Get your token first (see GET_OAUTH_TOKEN.md)

# Run the test
MCP_OAUTH_TOKEN="your_token_here" npx tsx test-mcp-direct.ts

# Watch Railway logs while testing
# Visit: https://railway.app/project/2daab0e5-db69-4152-a595-23af33325731
# Or use CLI:
railway link -p 2daab0e5-db69-4152-a595-23af33325731
railway logs --follow
```

---

## What the Test Does

1. **Connects** to `https://googleworkspacemcp-production.up.railway.app/mcp`
2. **Lists tools** to verify `create_event` exists
3. **Calls create_event** with:
   ```json
   {
     "summary": "MCP Test Event - Direct Call",
     "start_time": "2025-10-22T09:00:00+11:00",
     "end_time": "2025-10-22T10:00:00+11:00",
     "description": "Test event created via direct MCP SDK call"
   }
   ```
4. **Shows the response** - success, error, or empty

---

## Next Steps After Test

1. **Share the output** - I'll analyze what the MCP server returned
2. **Check Railway logs** - See what happened server-side
3. **Decide next action**:
   - If successful: Focus on OpenAI approval flow
   - If failed: Fix the specific error shown

---

## Background

- Your app uses OpenAI Realtime API with MCP tools
- MCP calls should trigger approval requests
- Approval requests aren't being created anymore
- Arguments look correct (timezone included)
- But calls are abandoned with null output/error

Direct testing bypasses OpenAI and tests the MCP server in isolation.
