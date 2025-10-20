# Google Workspace MCP OAuth Integration Checklist

This document captures the expected sequence, configuration requirements, and
diagnostic checkpoints for the Workspace MCP OAuth 2.1 flow inside the Orby
Realtime app. Use it as the source of truth when validating deployments or
investigating regressions.

---

## 1. Prerequisites

### Google Cloud OAuth Client

- OAuth 2.0 client type: **Web application**.
- **Authorized JavaScript origins** must include:
  - `https://googleworkspacemcp-production.up.railway.app`
- **Authorized redirect URIs** must include:
  - `https://googleworkspacemcp-production.up.railway.app/oauth2callback`
- Note: the Orby frontend (`https://openai-realtime-agents-production-7953.up.railway.app`)
  does _not_ need to be registered because the MCP server proxies the flow.

### Workspace MCP (Railway) Environment

Required variables (typical multi-user deployment):

| Variable | Description |
| --- | --- |
| `MCP_ENABLE_OAUTH21=true` | Enables the FastMCP OAuth proxy (multi-user). |
| `WORKSPACE_MCP_STATELESS_MODE=true` | Optional but common in cloud deployments. |
| `WORKSPACE_EXTERNAL_URL=https://googleworkspacemcp-production.up.railway.app` | Ensures discovery endpoints use the public host instead of `http://localhost:8080`. |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | The Google OAuth credentials mentioned above. |

Verify the server responds:

```bash
curl https://googleworkspacemcp-production.up.railway.app/.well-known/oauth-authorization-server
```

Expected JSON fields include `authorization_endpoint` and `token_endpoint`
pointing at the public Railway domain.

### Orby Realtime Frontend

- Latest `main` branch with commits `AuthReturnErrorFix` and later.
- Deploy the build (e.g., `npm run build`) and publish to the Railway project
  `openai-realtime-agents-production-7953`.
- Confirm `/oauth/callback` renders the new Suspense wrapper and not the old
  direct client component.

---

## 2. Runtime Flow Overview

| Step | Action | Expected Outcome | Instrumentation / Validation |
| --- | --- | --- | --- |
| 1 | Open **MCP Servers** modal and select the Workspace template | Metadata panel populates from `/.well-known/oauth-authorization-server` | Network tab: POST `/api/mcp/auth-info` → 200 with `authorize_url` and `token_url`. |
| 2 | Click **Authorize Google Workspace** | Button switches to “Waiting for authorization…”. A new tab opens on `https://googleworkspacemcp-production.up.railway.app/authorize?...` | Network tab: POST `/api/mcp/oauth/register` → 201. `localStorage` now contains `mcp_oauth_state_<state>`. |
| 3 | Google consent screen | User signs in and approves scopes | Observe Google-hosted screen. |
| 4 | Google redirects to `/oauth/callback?code=…&state=…` | Callback page shows loading spinner briefly then “Authorization complete. You may close this window.” | Network tab on popup: POST `/api/mcp/oauth/token` → 200. Console logs `postMessage` event to opener. |
| 5 | Popup closes manually or via button | Parent window receives `mcp-oauth-complete` message and re-enables button | In parent tab DevTools console: `window.addEventListener('message', console.log);` should show event with `token`. |
| 6 | Modal updates header list | A new header row appears: `Authorization` / `Bearer <token>` | Visual check; `draft.headers` now includes the bearer token. |
| 7 | Click **Save server** | `/api/mcp/list-tools` succeeds and chip shows `connected` | Network tab: POST `/api/mcp/list-tools` returns 200. |

If any step fails, use the checkpoints below.

---

## 3. Diagnostic Checklist

### Authorization window never opens

- Ensure browser didn’t block popups.
- Verify `authorize_url` exists in the auth info response.
- Confirm `/api/mcp/oauth/register` returns 201 (check browser network tab or server logs).

### Callback shows “Authorization session has expired or is invalid.”

- Inspect `localStorage` in the pop-up (`Application → Local Storage → your domain`).
  Should contain `mcp_oauth_state_<state>` with recent timestamp.
- Verify the stored `state` matches the query parameter on the callback URL.
- Ensure deployment includes commit `AuthReturnErrorFix` (look for `localStorage` usage in `src/app/oauth/callback/client.tsx`).

### Authorization completes but modal still shows no token / Save server returns 401

- In the parent tab console, run:
  ```js
  window.addEventListener('message', (event) => console.log(event));
  ```
  Trigger the flow again; you should see a `type: "mcp-oauth-complete"` event.
- If no event arrives, the parent page may be an older build without the
  message handler. Ensure the frontend deployment is current.
- Check `draft.headers` state in React DevTools to confirm the Authorization
  header was set.
- Verify the MCP server’s `/register` endpoint doesn’t require extra headers
  (should work anonymously; token issuance handled by Google).

### `redirect_uri_mismatch`

- Recheck Google Cloud entry: redirect must be
  `https://googleworkspacemcp-production.up.railway.app/oauth2callback`.
- Verify the MCP discovery endpoint returns the same redirect path.

### Production still serving old code

- Hit `/oauth/callback?ts=<timestamp>` and view the page source. It should show
  the simple Suspense wrapper importing `callback/client`.
- `curl https://openai-realtime-agents-production-7953.up.railway.app/_next/static/chunks/pages/oauth/callback` and ensure the hash matches the local build (optional but deterministic).

---

## 4. Resetting / Recovery

- If the flow fails midway, clear `localStorage` entries starting with
  `mcp_oauth_state_` and retry.
- To invalidate tokens server-side, restart the Workspace MCP deployment (it
  keeps sessions in memory when stateless mode is enabled).

---

## 5. Open Questions / Next Iteration

- Should the modal automatically save the server once the Authorization header
  is inserted? (Currently it requires a manual click.)
- Do we want to surface success/error toasts for the OAuth completion message?
- After token exchange we only store the access token; if refresh token handling
  is desired we can extend the backend proxies accordingly.

