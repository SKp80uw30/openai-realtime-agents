# Repository Guidelines

## Project Structure & Module Organization
This Next.js TypeScript app lives under `src/app`. Routing, layouts, and shared UI sit beside feature code: `page.tsx` for the landing experience, `layout.tsx` for global wrappers, and `components/`, `hooks/`, and `contexts/` for reusable pieces. Agent behavior is defined in `agentConfigs/` (e.g., `chatSupervisor/`, `customerServiceRetail/`, `simpleHandoff.ts`), while API routes and realtime session orchestration live in `api/`. Global styling and Tailwind layers reside in `globals.css` and `public/` holds static assets such as screenshots.

## Build, Test & Development Commands
Use `npm run dev` for a local development server with hot reload. `npm run build` produces the optimized Next.js bundle, and `npm run start` serves that build (run after `build`). `npm run lint` executes the ESLint suite configured via `eslint.config.mjs` to ensure consistency before committing.

## Coding Style & Naming Conventions
Follow the repository’s default TypeScript + ESLint rules: 2-space indentation, semicolons enforced, and camelCase for variables, PascalCase for React components, and kebab-case for files in `app/` routes. Tailwind utility classes stay inline; extract shared styling into `components/` when duplication grows. Keep agent prompts and schemas co-located with their configs so downstream tools stay easy to trace.

## Testing Guidelines
Automated tests are not yet implemented. Before raising a PR, run `npm run lint`, then exercise each scenario via the UI: verify realtime handoffs in `chatSupervisor`, multi-agent transfers in `customerServiceRetail`, and audio capture flows in supported browsers. Document any manual steps in the PR description until formal tests land.

## Commit & Pull Request Guidelines
Commits should be scoped and written in the imperative tense (e.g., `Add customer handoff logging`), mirroring the existing history. Reference related issues or PR numbers when relevant. For pull requests, include: a concise summary, screenshots or screen recordings for UI changes, environment assumptions (e.g., required env vars), and manual test notes. Draft PRs are encouraged for early feedback when modifying agent prompts or session wiring.

## Agent Configuration Tips
Each agent config exports a typed definition consumed by the Next.js client. When introducing a new agent, start from an existing config, update `agentConfigs/index.ts`, and confirm any new downstream tools are registered via `injectTransferTools`. Store reusable prompts in plain-text files (see `voiceAgentMetaprompt.txt`) to simplify iteration and review.
Use the `MCP Servers` control in the header to register remote connectors (Zapier, Google Drive, etc.). Provide the connector URL plus any required headers (for Zapier, keep the prefilled `Authorization: Bearer ` header and append the long API token Zapier gives you). The modal lists the tools the server exposes after the connection test, and the selections are stored per scenario and forwarded to the realtime session as `mcp` tools so the assistant can call them immediately after reconnecting.
