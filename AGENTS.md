# Repository Guidelines

## Project Structure & Module Organization
Next.js app routes live in `src/app/` (each route exposes a `page.tsx`, optional `layout.tsx`). Shared UI, session hooks, and context providers sit in `src/app/components/`, `hooks/`, and `contexts/`. Agent definitions and prompts are under `src/app/agentConfigs/` (e.g., `personalAssistant/`, `simpleHandoff.ts`, `voiceAgentMetaprompt.txt`). API routes (including MCP helpers) live in `src/app/api/`. Global styles live in `src/app/globals.css`, static assets in `public/`, and contributor docs in `docs/` (see `google-workspace-oauth-flow.md`).

## Build, Test, and Development Commands
- `npm run dev` — launch the dev server with hot reload on `http://localhost:3000`.
- `npm run build` — create an optimized production bundle; run before deploying.
- `npm run start` — serve the built bundle locally to verify deployments.
- `npm run lint` — execute ESLint/TypeScript checks defined in `eslint.config.mjs`.

## Coding Style & Naming Conventions
Use TypeScript, React, and Tailwind CSS. Follow 2-space indentation, semicolons, camelCase for functions/variables, and PascalCase for components. Route folders inside `app/` stay kebab-case. Keep prompt text in plain `.txt` files and avoid embedding long strings inline. Let ESLint autofix formatting (`npm run lint -- --fix`) and prefer descriptive prop/variable names (e.g., `oauthStateKey` over `stateKey`).

## Testing Guidelines
There is no automated test suite yet; linting is the gating check. Before opening a PR, run through manual scripts: new MCP flows (`docs/google-workspace-oauth-flow.md`), agent transfers in `chatSupervisor`, and realtime audio capture. Log manual coverage, edge cases, and regressions in the PR description.

## Commit & Pull Request Guidelines
Commit messages follow short, imperative phrases (`Add calendar tool logging`). Squash noisy fixups before review. PRs should describe user-visible changes, list new env vars/config, include screenshots or recordings for UI updates, and document manual test results. Link related issues and highlight follow-up tasks when applicable.

## Agent & MCP Integration Tips
When adding an agent, export it from `src/app/agentConfigs/index.ts`, provide clear instructions, and register downstream handoffs. Use the MCP Servers modal to verify connectors; watch the Logs panel for `agent.tool_start`/`agent.tool_end` events to confirm tool usage. For Google Workspace OAuth, follow the checklist in `docs/google-workspace-oauth-flow.md` to ensure tokens persist and tools appear in `mcp_list_tools.completed`.

## Debugging MCP Tool Calls

### Frontend Logging

The app now logs detailed MCP call information in both the Transcript panel and Event log:

1. **Transcript Panel (left side)**: Look for breadcrumbs:
   - `MCP call: <tool_name>` - Shows when a tool is initiated with server, arguments, and call_id
   - `MCP result: <tool_name>` - Shows the result with output, error, status, and a warning if both output and error are null

2. **Event Log (right side)**: Filter for:
   - `agent.mcp_call.initiated` - Full details when MCP tool is called
   - `agent.mcp_call.completed` - Full response including null detection
   - `agent.mcp_approval.pending` / `agent.mcp_approval.auto_sent` - MCP approval flow

### Common MCP Issues

**Symptom**: MCP call returns `output: null, error: null`

Possible causes:
1. **Google API rejection**: Token expired, insufficient scopes, or API disabled
2. **MCP server error**: Server crashed or failed to handle the request
3. **Argument validation**: Arguments don't match Google API requirements
4. **Network/timeout**: Request to Google timed out without error reporting

**Debugging steps**:

1. **Check Railway logs for the Workspace MCP server**:
   ```bash
   # Link to the MCP server project
   railway link -p 2daab0e5-db69-4152-a595-23af33325731

   # Tail logs to see real-time MCP activity
   railway logs --follow

   # Filter for specific tool calls
   railway logs | grep "create_event"
   railway logs | grep "ERROR"
   ```

2. **Look for these patterns in MCP logs**:
   - `[create_event]` - Tool execution logs
   - Stack traces or Python exceptions
   - Google API error responses (401, 403, 400)
   - Token refresh failures

3. **Check the frontend MCP logs**:
   - Verify `arguments` in `agent.mcp_call.initiated` match the tool schema
   - Confirm `server_label` matches your configured server
   - Check if approval was auto-sent via `agent.mcp_approval.auto_sent`

4. **Verify MCP server configuration**:
   ```bash
   # Switch to MCP project
   railway link -p 2daab0e5-db69-4152-a595-23af33325731

   # Check environment variables
   railway variables

   # Ensure these are set:
   # - MCP_ENABLE_OAUTH21=true
   # - WORKSPACE_MCP_STATELESS_MODE=true
   # - WORKSPACE_EXTERNAL_URL=https://googleworkspacemcp-production.up.railway.app
   # - GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET
   ```

5. **Test OAuth token validity**:
   - Re-authorize in the MCP modal
   - Check if new token resolves the issue
   - Token may have expired or been revoked

6. **Verify Google Cloud Console**:
   - Ensure Calendar API is enabled
   - Check OAuth consent screen status
   - Verify authorized redirect URIs match the MCP server URL

### Railway Log Analysis

When debugging null responses, correlate frontend and backend logs:

**Frontend** (openai-realtime-agents):
```bash
railway link -p 01f38d25-544f-47e9-82d3-04af802b5337
railway logs --follow
```
Look for: Session creation, MCP server payload sent to OpenAI

**Backend** (google_workspace_mcp):
```bash
railway link -p 2daab0e5-db69-4152-a595-23af33325731
railway logs --follow
```
Look for: Tool execution, Google API calls, error responses

**Typical successful flow**:
1. Frontend: `agent.mcp_call.initiated` with tool name and arguments
2. Backend MCP: `[create_event]` or similar tool log
3. Backend MCP: Google API request/response
4. Frontend: `agent.mcp_call.completed` with non-null output

**Typical failure with null**:
1. Frontend: `agent.mcp_call.initiated`
2. Backend MCP: Silent (no log) OR error logged
3. Frontend: `agent.mcp_call.completed` with `output: null, error: null`

If backend is silent, the MCP server likely crashed before logging. Check for:
- Memory/CPU limits exceeded
- Uncaught exceptions in FastMCP
- OAuth token storage issues in stateless mode
