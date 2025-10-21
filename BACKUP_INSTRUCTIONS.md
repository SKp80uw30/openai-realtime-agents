# Backup & Restore Instructions

## Current Working State

**Git Tag:** `v1.0.0-mcp-working`
**Commit:** `7c1c5805` (HEAD) or `68377a13` (actual fix)
**Date:** October 21, 2025
**Status:** ✅ MCP Calendar Events Working

---

## Quick Restore

If something breaks, restore to this working state:

```bash
# Restore to working state
git checkout v1.0.0-mcp-working

# Or use commit hash
git checkout 68377a13

# If you want to create a new branch from this state
git checkout -b restore-mcp-working v1.0.0-mcp-working
```

---

## Create Full Backup

```bash
# 1. Clone the repository to a backup location
cd ~/backups
git clone https://github.com/SKp80uw30/openai-realtime-agents.git orbyRealtime-backup-$(date +%Y%m%d)

# 2. Checkout the working tag
cd orbyRealtime-backup-$(date +%Y%m%d)
git checkout v1.0.0-mcp-working

# 3. Archive it
cd ..
tar -czf orbyRealtime-backup-$(date +%Y%m%d).tar.gz orbyRealtime-backup-$(date +%Y%m%d)/

# 4. Verify
tar -tzf orbyRealtime-backup-$(date +%Y%m%d).tar.gz | head
```

---

## Railway Deployment Backup

### Current Deployments

**Frontend (openai-realtime-agents):**
- Project ID: `01f38d25-544f-47e9-82d3-04af802b5337`
- URL: https://openai-realtime-agents-production-7953.up.railway.app
- Deployment: Linked to GitHub `main` branch at commit `7c1c5805`

**MCP Server (google_workspace_mcp):**
- Project ID: `2daab0e5-db69-4152-a595-23af33325731`
- URL: https://googleworkspacemcp-production.up.railway.app
- Repository: https://github.com/taylorwilsdon/google_workspace_mcp

### Lock Railway to Specific Commit

If you want to prevent auto-deployments:

```bash
# In Railway dashboard:
# 1. Go to project settings
# 2. Deployments → Settings
# 3. Disable "Auto Deploy from GitHub"
# 4. Manually deploy from specific commit: 7c1c5805
```

---

## Environment Variables Backup

### Frontend (.env)

```bash
OPENAI_API_KEY=sk-proj-...
```

### MCP Server (Railway Variables)

```bash
MCP_ENABLE_OAUTH21=true
WORKSPACE_MCP_STATELESS_MODE=true
WORKSPACE_EXTERNAL_URL=https://googleworkspacemcp-production.up.railway.app
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

**Export from Railway:**
```bash
railway link -p 2daab0e5-db69-4152-a595-23af33325731
railway variables > mcp-server-env-backup-$(date +%Y%m%d).txt
```

---

## Critical Files for This Milestone

If you need to manually restore, these are the key files:

### 1. Session Configuration
**File:** `src/app/api/session/route.ts`
**Line:** 19
**Critical:** `require_approval: 'never'`

```typescript
const tools = mcpServers.length
  ? mcpServers.map((server) => ({
      type: 'mcp',
      server_label: server.label,
      server_url: server.server_url,
      headers: server.headers,
      allowed_tools: server.allowed_tools,
      require_approval: 'never',  // ⚠️ CRITICAL: Use 'never', not 'always'
    }))
  : undefined;
```

### 2. MCP Call Tracking
**File:** `src/app/hooks/useRealtimeSession.ts`
**Lines:** 46-193
**Critical:** `pendingMcpCallsRef` for argument timing

### 3. Agent Prompt
**File:** `src/app/agentConfigs/personalAssistant/index.ts`
**Lines:** 101-120
**Critical:** RFC3339 timezone format requirements

### 4. MCP Call Logging
**File:** `src/app/hooks/useHandleSessionHistory.ts`
**Lines:** 145-171
**Critical:** `handleMcpCallInitiated` and `handleMcpCallCompleted`

---

## Restore From Backup Archive

```bash
# Extract backup
tar -xzf orbyRealtime-backup-YYYYMMDD.tar.gz

# Copy to current location
cd orbyRealtime-backup-YYYYMMDD
cp -r . /Users/stevekelly/myApps/orbyRealtime/

# Verify
cd /Users/stevekelly/myApps/orbyRealtime
git log --oneline | head -5
# Should show: 7c1c5805 (HEAD -> main, tag: v1.0.0-mcp-working)

# Reinstall dependencies
npm install

# Build and test
npm run build
npm run dev
```

---

## Verification Checklist

After restoring, verify everything works:

- [ ] `git log` shows commit `7c1c5805` or `68377a13`
- [ ] `src/app/api/session/route.ts` has `require_approval: 'never'`
- [ ] `npm run build` succeeds without errors
- [ ] Railway deployment is linked to the correct commit
- [ ] MCP server environment variables are set
- [ ] OAuth flow works in browser
- [ ] `mcp_list_tools.completed` appears in logs (84 tools)
- [ ] Calendar event creation works via voice command
- [ ] Events appear in Google Calendar

---

## Rollback Commits

If you need to undo changes made after this milestone:

```bash
# See what changed since milestone
git log v1.0.0-mcp-working..HEAD

# Soft reset (keeps changes in working directory)
git reset --soft v1.0.0-mcp-working

# Hard reset (discards all changes - DANGEROUS)
git reset --hard v1.0.0-mcp-working

# Force push if needed (DANGEROUS - only if you're sure)
git push --force origin main
```

---

## Documentation Archive

Key documents created during this milestone:

- `MILESTONE_MCP_WORKING.md` - Complete milestone documentation
- `BACKUP_INSTRUCTIONS.md` - This file
- `FIX_SUMMARY.md` - Summary of the require_approval fix
- `AGENTS.md` - MCP integration guidelines
- `GET_OAUTH_TOKEN.md` - OAuth token extraction
- `MCP_DIRECT_TEST_RESULTS.md` - Direct testing results
- `TESTING_STATUS.md` - Testing methodology
- `README_MCP_TESTING.md` - Quick reference
- `scripts/test-mcp-direct.ts` - Direct MCP testing tool

All documents are committed and tagged with `v1.0.0-mcp-working`.

---

## Emergency Contacts

**Repository:** https://github.com/SKp80uw30/openai-realtime-agents
**Working Tag:** https://github.com/SKp80uw30/openai-realtime-agents/releases/tag/v1.0.0-mcp-working
**Railway Frontend:** https://railway.app/project/01f38d25-544f-47e9-82d3-04af802b5337
**Railway MCP:** https://railway.app/project/2daab0e5-db69-4152-a595-23af33325731

---

## What to Backup Regularly

1. **Before Major Changes:**
   ```bash
   git tag -a backup-$(date +%Y%m%d-%H%M) -m "Backup before [description]"
   git push --tags
   ```

2. **Railway Environment Variables:**
   ```bash
   railway variables > backup-env-$(date +%Y%m%d).txt
   ```

3. **Google OAuth Credentials:**
   - Document Client ID and Secret in secure location
   - Screenshot OAuth consent screen settings
   - Export authorized redirect URIs

4. **MCP Server OAuth Tokens:**
   - Stored in Railway MCP server (stateless mode)
   - Can be refreshed via OAuth flow in app

---

**Remember:** Always test in development before deploying to production!
