# Repository Guidelines

## Project Structure & Module Organization
The Next.js TypeScript app lives under `src/app`. Route folders hold `page.tsx` and optional `layout.tsx`, with shared UI in `components/`, `contexts/`, and `hooks/`. Agent implementations live in `src/app/agentConfigs/` (e.g., `chatSupervisor/`, `customerServiceRetail/`, `simpleHandoff.ts`). API handlers and realtime session logic sit under `src/app/api/`. Global styles are in `src/app/globals.css`, while static assets such as screenshots reside in `public/`. Configuration, linting, and Tailwind setup files stay at the repository root.

## Build, Test, and Development Commands
- `npm run dev` starts the local dev server with hot reload at `http://localhost:3000`.
- `npm run build` compiles the production bundle; run this before deploying.
- `npm run start` serves the optimized build locally for verification.
- `npm run lint` runs ESLint using `eslint.config.mjs` and should be clean before committing.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation and required semicolons. Apply camelCase for variables and functions, PascalCase for React components, and kebab-case for route folders inside `app/`. Keep Tailwind utility classes inline unless extraction improves reuse; shared styling components belong in `components/`. Let ESLint autofix handle formatting where possible (`npm run lint -- --fix`).

## Testing Guidelines
Automated tests are not yet implemented. Run `npm run lint` before every commit, then manually cover key flows: realtime handoffs in `chatSupervisor`, sequential transfers in `customerServiceRetail`, and browser audio capture. Log manual coverage, edge cases, and any blockers in your PR description.

## Commit & Pull Request Guidelines
Write scoped, imperative commit messages (e.g., `Add supervisor escalation prompt`). Squash noisy fixup commits before opening the PR. PRs should link related issues, summarize user-visible changes, call out required env vars, and attach screenshots or recordings for UI updates. Include manual test notes and highlight known risks or follow-up work.

## Agent Configuration Tips
Each agent config exports typed metadata consumed by the client. When adding an agent, start from an existing config, update `src/app/agentConfigs/index.ts`, and register downstream tools via `injectTransferTools`. Store reusable prompts in plain text files such as `voiceAgentMetaprompt.txt` for easy review. Use the MCP Servers modal to register external connectors and confirm exposed tools before enabling them.
