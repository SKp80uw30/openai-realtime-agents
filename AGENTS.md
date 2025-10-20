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
