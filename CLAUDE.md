# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Orby Realtime**, a Next.js 15 voice agent application built on the OpenAI Realtime API and OpenAI Agents SDK. The app demonstrates advanced voice agent patterns with Google Workspace integration via MCP (Model Context Protocol) and includes authentication via NextAuth with Google OAuth.

## Development Commands

```bash
# Install dependencies
npm i

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint
npm lint

# Database operations (Prisma)
npx prisma generate          # Generate Prisma client after schema changes
npx prisma db push           # Push schema changes to database
npx prisma studio            # Open Prisma Studio GUI
```

## Environment Setup

Required environment variables in `.env`:
- `OPENAI_API_KEY` - OpenAI API key for Realtime API access
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Base URL (http://localhost:3000 for dev)
- `NEXTAUTH_SECRET` - Secret for NextAuth session encryption
- `GOOGLE_CLIENT_ID_LOGIN` - Google OAuth client ID for user authentication
- `GOOGLE_CLIENT_SECRET_LOGIN` - Google OAuth client secret for user authentication

**Note:** Separate Google OAuth clients are used for login vs MCP integration. The `_LOGIN` suffix credentials are for user authentication only.

## Architecture

### Authentication Flow (NextAuth + Prisma)

- **Strategy**: JWT-based sessions with Prisma adapter for user/account persistence
- **Location**: `src/app/lib/auth.ts` configures NextAuth with Google provider
- **Critical**: When using `strategy: 'jwt'` with `PrismaAdapter`, you must implement both `jwt` and `session` callbacks to properly populate the JWT token with user data during OAuth sign-in
- **Provider**: `src/app/components/AuthSessionProvider.tsx` wraps the app with NextAuth's SessionProvider
- **Database**: User, Account, Session, VerificationToken, and WorkspaceCredential models in `prisma/schema.prisma`

### Realtime Voice Agent Architecture

The app uses the **OpenAI Agents SDK** (`@openai/agents`) to manage voice agents. There are two primary agentic patterns:

#### 1. Chat-Supervisor Pattern
Located in `src/app/agentConfigs/chatSupervisor/`

- A realtime chat agent (`gpt-4o-realtime-mini`) handles basic conversation and info collection
- A text-based supervisor agent (`gpt-4.1`) handles complex reasoning and tool calls
- The chat agent defers to the supervisor when it needs higher intelligence
- See README.md for detailed flow diagrams and implementation guide

#### 2. Sequential Handoff Pattern
Demonstrated in `src/app/agentConfigs/customerServiceRetail/` and `src/app/agentConfigs/simpleHandoff.ts`

- Specialized agents handle specific user intents (authentication, returns, sales, etc.)
- Agents transfer users between each other via tool calls
- Each agent has its own instructions, tools, and allowed handoffs
- Inspired by OpenAI Swarm architecture

### Agent Configuration System

**Registry**: `src/app/agentConfigs/index.ts` exports all available agent scenarios:
- `simpleHandoff` - Basic two-agent handoff demo
- `customerServiceRetail` - Complex multi-agent customer service flow
- `chatSupervisor` - Chat-supervisor hybrid pattern
- `personalAssistant` - Personal assistant with MCP integration (default for Orby)

Each agent config exports an array of `RealtimeAgent` objects with:
- `name` - Unique identifier
- `handoffDescription` - Context for agent transfer tool
- `instructions` - Prompt/behavior definition
- `tools` - Available function calls
- `handoffs` - Array of agents this agent can transfer to

### Realtime Session Management

**Hook**: `src/app/hooks/useRealtimeSession.ts` manages WebRTC connection to OpenAI Realtime API

Key responsibilities:
- Establishing WebRTC connection with ephemeral keys from `/api/session`
- Managing MCP tool call approval and execution
- Handling agent handoffs
- Audio stream management
- Event logging for debugging

**Session Flow**:
1. Client calls `/api/session` (requires authentication) with MCP server configs
2. Server creates ephemeral session token from OpenAI with MCP tools attached
3. Client establishes WebRTC connection using ephemeral key
4. Audio streams bidirectionally; agent responses trigger via server VAD
5. MCP tool calls are intercepted, approved, and results returned to conversation

### MCP (Model Context Protocol) Integration

**Purpose**: Connects voice agents to external tools (Google Workspace, Zapier, etc.)

**API Routes**:
- `/api/session` - Creates OpenAI Realtime session with MCP tools
- `/api/mcp/list-tools` - Lists available tools from an MCP server
- `/api/mcp/oauth/register` - Stores Google Workspace OAuth tokens
- `/api/mcp/auth-info` - Retrieves stored workspace credentials

**Client-side**: `src/app/orb-showcase/GoogleWorkspaceConnector.tsx` manages MCP server UI and OAuth flow

**Storage**: MCP servers are persisted in localStorage with key `mcpServers:personalAssistant`

**Important**: MCP servers include headers (like OAuth tokens) that are sent to OpenAI Realtime API as part of tool configuration

### UI Structure

**Main Page**: `src/app/page.tsx` renders `OrbShowcase` component wrapped in context providers

**OrbShowcase** (`src/app/orb-showcase/OrbShowcase.tsx`):
- Authentication gate - shows login UI if not authenticated
- OrbVisualizer - 3D animated orb with themes (Holographic, Cyberpunk, etc.)
- Connection controls - Connect/Disconnect to Realtime API
- MCP server management - Tool overlay for connecting Google Workspace
- Session indicators - Live/Standby status, conversation state

**Contexts**:
- `TranscriptContext` - Manages conversation transcript breadcrumbs
- `EventContext` - Logs client/server events for debugging

**Components**:
- `src/app/components/orb/` - OrbVisualizer and related orb rendering logic
- `src/app/components/orb/hooks/` - useOrbAudioAnalysis, useOrbConversationState

### Database Schema (Prisma)

**Models**:
- `User` - User accounts with email, name, image
- `Account` - OAuth provider accounts (Google) with tokens
- `Session` - NextAuth sessions (used for database strategy, though we use JWT)
- `WorkspaceCredential` - Google Workspace OAuth tokens for MCP integration

**Note**: The app uses JWT session strategy but keeps the Prisma adapter to persist user accounts in the database. This hybrid approach requires careful JWT callback configuration.

## Common Gotchas

### NextAuth with JWT + Prisma Adapter
When using `session: { strategy: 'jwt' }` with `PrismaAdapter`, you must implement a `jwt` callback to capture user data during sign-in. Without it, the JWT token won't be populated and users will be stuck in an auth loop.

### Google OAuth Redirect URIs
For NextAuth Google provider, the authorized redirect URI must be exactly:
```
http://localhost:3000/api/auth/callback/google
```
No trailing slash, and must include `/google` at the end.

### MCP Server Configuration
MCP servers must include valid authentication headers (Bearer tokens, OAuth tokens, etc.) when passed to `/api/session`. The OpenAI Realtime API will use these headers when calling the MCP server's tools.

### Audio Element Management
The OrbShowcase creates a hidden `<audio>` element for Realtime API audio playback. This must be created client-side only (`typeof window !== 'undefined'`) and cleaned up on unmount to prevent memory leaks.

## Deployment (Railway)

See `DEPLOYMENT.md` for full Railway deployment guide. Key points:

- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Required env vars: `OPENAI_API_KEY`, `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID_LOGIN`, `GOOGLE_CLIENT_SECRET_LOGIN`
- Railway auto-detects Next.js and provides HTTPS (required for WebRTC)
- Use Railway Logs tab to debug MCP and session issues in production

## Adding New Agent Scenarios

1. Create new agent config file in `src/app/agentConfigs/yourScenario/`
2. Define `RealtimeAgent` instances with instructions, tools, and handoffs
3. Export agent array from `index.ts`
4. Add to `src/app/agentConfigs/index.ts`:
   - Add to `allAgentSets` record
   - Add label to `agentSetLabels`
5. Scenario will appear in UI dropdown automatically

Use the voice agent metaprompt at `src/app/agentConfigs/voiceAgentMetaprompt.txt` or the [Voice Agent Metaprompter GPT](https://chatgpt.com/g/g-678865c9fb5c81918fa28699735dd08e-voice-agent-metaprompt-gpt) for help creating prompts.

## Output Guardrails

Assistant messages are checked for safety before display. The guardrail logic uses a moderation API to detect policy violations. When a `response.text.delta` stream starts, messages are marked as `IN_PROGRESS`. Once `guardrail_tripped` or `response.done` events fire, messages are marked as `FAIL` or `PASS`.

Guardrail configuration is in `src/app/agentConfigs/guardrails.ts`.
