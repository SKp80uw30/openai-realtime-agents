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
