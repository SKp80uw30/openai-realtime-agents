# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` contains the Next.js App Router pages, components, hooks, and API routes. Key features live in `orb-showcase/`, `hooks/`, and `api/session` for realtime connectivity.
- `public/` hosts static assets (icons, screenshots, service worker) used by the orb interface and PWA features.
- `prisma/schema.prisma` defines the PostgreSQL models for Auth.js (users, sessions, workspace credentials). Generated client code lives under `node_modules/@prisma/client` after `prisma generate`.

## Build, Test, and Development Commands
- `npm run dev` – launches the Next.js dev server with hot reload at `http://localhost:3000`.
- `npm run build` – produces an optimized production bundle. Run before deploying to Railway.
- `npm run start` – serves the previously built bundle in production mode (used by Railway).
- `npm run lint` – executes ESLint with the Next.js config; it is the primary automated check.

## Coding Style & Naming Conventions
- TypeScript + React with App Router. Prefer client components only when browser APIs are required.
- Use 2-space indentation, semicolons, and camelCase for variables/functions; PascalCase for React components.
- Tailwind classes are acceptable inside JSX; shared styling belongs in `globals.css`.
- Run `npm run lint -- --fix` to apply formatting and enforce rules before committing.

## Testing Guidelines
- Automated tests are not yet defined; linting acts as the gate. Document manual test coverage in PR descriptions (voice flows, MCP calls, auth).
- When adding tests, colocate them with the feature (e.g., `feature.test.ts`) and hook into `npm test` for future CI wiring.

## Commit & Pull Request Guidelines
- Follow short, imperative commit messages (e.g., “Add orb PWA manifest”, “Fix MCP follow-up trigger”). Squash trivial fixups before merging.
- Pull requests should describe user-visible changes, list new environment variables, attach screenshots for UI updates, and note manual verification steps (e.g., “Validated Google login + MCP calendar tool”).

## Security & Configuration Tips
- Do not commit secrets. Configure `GOOGLE_CLIENT_ID_LOGIN`, `GOOGLE_CLIENT_SECRET_LOGIN`, and `DATABASE_URL` through environment variables (local `.env`, Railway secrets).
- Keep two separate Google OAuth clients: one for app login, one for MCP server. Ensure redirect URIs include `/api/auth/callback/google` for the app and `/oauth2callback` for the MCP service.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **openai-realtime-agents** (1254 symbols, 1609 relationships, 24 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/openai-realtime-agents/context` | Codebase overview, check index freshness |
| `gitnexus://repo/openai-realtime-agents/clusters` | All functional areas |
| `gitnexus://repo/openai-realtime-agents/processes` | All execution flows |
| `gitnexus://repo/openai-realtime-agents/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
