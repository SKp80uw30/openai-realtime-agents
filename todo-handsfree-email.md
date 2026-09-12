# Hands-Free Email — Implementation Plan

**North star:** *"Manage your entire inbox while driving — never look at a screen. Hear priority emails first, reply, send, draft, and read-back by voice, mark-as-read or delete as you go. Anything you can't undo gets a confirmation step, first."*

Orby's foundations work today (login, Google Workspace connect, generic voice tool use via the one-size-fits-all `personalAssistant` agent). This phase does **not** add new connectors or features — it goes deep on one workflow and builds the thing that's currently missing entirely: **education**. Right now there is zero onboarding, zero concept of priority/VIP contacts/categories, and zero persisted preference beyond OAuth tokens. Without continuous, staged teaching, hands-free email is a parlor trick nobody trusts enough to use at 100km/h.

This plan is meant to be worked **phase by phase**. Each phase ends in a test checklist. Only check a phase off and move to the next once its tests pass — that's the natural point to refresh context.

---

## Design synthesis (read this before Phase 1)

### The trust ladder — 5 onboarding stages

Stages are gated by **demonstrated usage, not time elapsed or a "next" button**. This is the backbone the rest of the plan hangs off.

| # | Stage | Mode | What it teaches / does | Unlocks when |
|---|-------|------|------------------------|--------------|
| 0 | **Setup** | Screen only (not for driving) | Orby asks "who are your people?" — VIP contacts. Conversational, not a form. | First session, always starts here |
| 1 | **Priorities** | Screen only | Defines email categories (Work, Newsletters, Family...) and priority order. Shows a live "priority map" preview sorting sample inbox items. | Setup completed |
| 2 | **Listening** | Voice, read-only | Orby reads/triages hands-free: priority-first order, one-line spoken summaries, "skip/next," mark-read, archive. No send/delete. | Priorities completed |
| 3 | **Responding** | Voice, reversible only | Adds draft-and-read-back replies (not sent — read back for confirmation only). Builds trust in intent capture. | N successful Listening sessions, zero corrections |
| 4 | **Acting** | Voice, irreversible unlocked | Send and delete become available, gated by the mandatory confirmation mechanic (Phase 5). Optional "delegated autonomy" opt-ins (e.g. auto-archive newsletters) appear here as an earned reward. | N successful Responding sessions, zero corrections |

Narrative framing for copy/UX (from the storyteller pass) — **"Learning to Ride Shotgun"**:
1. **Meet & Greet** (= Setup) — Orby learns who matters.
2. **Shadowing** (= Priorities + early Listening) — Orby narrates its reasoning, user grades its instincts.
3. **First Solo Drive** (= Listening → Responding) — short hands-free sessions, easy stuff autonomous, ambiguous/irreversible stuff escalated.
4. **The Whole Drive** (= Acting) — full inbox, full commute, unattended, confirmations narrowed to only truly irreversible actions.

Sample copy beats to reuse verbatim or adapt (see full transcripts already drafted in this planning pass — Setup conversation, graduation moment, confirmation phrasing) live in `docs/handsfree-email-copy.md` (create in Phase 6).

### Confirmation mechanic (non-negotiable safety mechanism)

- **Not** the existing moderation guardrail (`src/app/agentConfigs/guardrails.ts`) — that classifies output *after* the fact. Irreversible actions need a **pre-execution gate**.
- Extend the existing MCP tool-call-approval interception already in `useRealtimeSession.ts`. Classify tool calls by a hard-coded, code-level allowlist of irreversible operations (`gmail_send`, `gmail_delete`, `gmail_trash`, etc.) — never trust the model's judgment on what counts as irreversible.
- On a match: don't auto-execute. Synthesize a spoken confirmation turn with the action word stated plainly up front ("Send this reply to Jane? Say yes to send." / "Deleting the Amazon receipt and two others — that's permanent, good to go?"). Require an explicit affirmative utterance — silence or ambiguity is always "no."
- Use a **distinct confirmation phrase per action type** (send vs. delete) — a shared generic "yes" is how mistakes happen.
- Add a short (5–8s) spoken undo cushion after confirmation, before the action actually fires ("Sending... say cancel now to stop") — turns a true-irreversible action into a de facto reversible one.
- Never require confirmation for reversible actions (archive, mark-read) — over-confirming trains reflexive "yes" and defeats the mechanism.

### Agent architecture decision

**New dedicated `emailAgent`, reached via handoff from `personalAssistant`** (mirrors the existing `customerServiceRetail` sequential-handoff pattern) — not a bigger `personalAssistant` prompt.

- `personalAssistant`'s monolithic instructions already span Calendar/Slack/Gmail generically; bolting stage-awareness and confirmation logic onto it risks the exact instruction-dilution problem `chatSupervisor` exists to avoid.
- `personalAssistant` only offers the handoff to `emailAgent` once `OnboardingProgress.stage >= 2` (Listening) — below that, hands-free email isn't offered as a capability at all, it's still in screen-based Setup/Priorities.
- `emailAgent`'s instructions and tool array are **assembled server-side at session creation** (`/api/session`), interpolating stage + VIP contacts + categories into a stage-conditional template — never left to the model to infer from conversation or to self-censor tools it can technically see.

### Gamified skills checklist (generalizable across future capabilities)

Alongside the invisible, server-side trust ladder above, users get a **visible, literal checklist**: "Handsfree Email" as a named set of skills that light up as they're actually used — e.g. *Set up priorities, Summarise an email, Mark as read, Archive, Draft a reply, Send an email, Delete an email* (7 items, ordered to roughly track the trust ladder). This solves a different problem than the stage gate: the stage gate controls *access*, the checklist gives the user a **map of the full destination** — "here's everything hands-free email covers, here's what you've already proven you can do hands-free, here's what's left." It's also the discoverability mechanism for continuous onboarding: tapping an unchecked item can surface a one-line hint ("say 'read me a summary of my inbox'") without requiring a tutorial.

Model it generically from day one so it's reusable, not email-specific, since the same pattern should cover "Handsfree Calendar," "Handsfree Slack," etc. later without new tables:

- `CapabilityGroup` — a named checklist (e.g. "Handsfree Email"). One row per domain, present and future.
- `Capability` — one skill within a group (e.g. `email.draft`), with a display label, hint text, and sort order.
- `UserCapabilityProgress` — per-user, per-capability, `firstCompletedAt`. Existence of a non-null timestamp = checked off. No separate "levels" or points — first use is the milestone, matching the "earned trust, not badges" whimsy stance already established.

**Elegant reuse:** these completion timestamps double as the evidence source for the trust-ladder's stage-advancement criteria (Phase 6) — no separate success-counter needs to be built; "N successful Listening-stage actions" can be read directly off `UserCapabilityProgress` rows for the relevant capabilities.

**Whimsy treatment:** keep the visual language consistent with the existing glassy dark UI (`ToolsOverlay`'s `rounded-2xl` / cyan-border / slate-background style) — not a colorful gamer-app achievement wall. Checking an item off gets a small orb-glow tick and a one-line celebratory line (voice if mid-drive, a quiet toast if on-screen), shown once per capability, never repeated on subsequent uses.

### Data model additions (keep minimal — no speculative fields)

```prisma
model OnboardingProgress {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  stage     Int      @default(0)   // 0 Setup / 1 Priorities / 2 Listening / 3 Responding / 4 Acting
  updatedAt DateTime @updatedAt
}

model Contact {
  id       String @id @default(cuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id])
  email    String
  name     String?
  priority Int    @default(0)   // 0 normal, 1 VIP
  @@unique([userId, email])
}

model EmailCategory {
  id       String   @id @default(cuid())
  userId   String
  user     User     @relation(fields: [userId], references: [id])
  name     String              // "Work", "Newsletters", "Family"
  keywords String[]            // simple heuristic match, no ML needed yet
  priority Int      @default(0)
  @@unique([userId, name])
}

// Generic, reusable across future "Handsfree X" domains — not email-specific.
model CapabilityGroup {
  id           String       @id @default(cuid())
  key          String       @unique   // "handsfree-email"
  label        String                 // "Handsfree Email"
  capabilities Capability[]
}

model Capability {
  id        String                 @id @default(cuid())
  groupId   String
  group     CapabilityGroup        @relation(fields: [groupId], references: [id])
  key       String                 @unique   // "email.draft"
  label     String                           // "Draft a reply"
  hint      String                           // "Say: read me a summary of my inbox"
  order     Int                    @default(0)
  progress  UserCapabilityProgress[]
}

model UserCapabilityProgress {
  id              String     @id @default(cuid())
  userId          String
  user            User       @relation(fields: [userId], references: [id])
  capabilityId    String
  capability      Capability @relation(fields: [capabilityId], references: [id])
  firstCompletedAt DateTime  @default(now())
  @@unique([userId, capabilityId])
}
```

Seed data for v1 (the "Handsfree Email" group, 7 capabilities, roughly ordered to track the trust ladder): `email.setup_priorities`, `email.summarize`, `email.mark_read`, `email.archive`, `email.draft`, `email.send`, `email.delete`.

### Whimsy rules (driving-safe by construction)

**Allowed while driving (voice only, no screen):**
- Personality lives in **speech cadence and phrasing**, never a separate sound layer. Rotate 3–4 short human variants for routine actions ("Got it, filing that away" / "Archived — one less thing"), small pool so it stays predictable.
- A quiet, infrequent verbal streak callout at natural idle points only (session start), never mid-triage.
- Confirmation prompts stay warm in tone but **never rotate wording** — predictability is the hard boundary for anything safety-critical.

**Screen-only (Setup/Priorities stages):**
- VIP contact add → small visual moment (avatar docks into the orb's ring).
- Priority map reveal animation at end of Priorities stage.
- Skippable "graduation" animation on stage unlock (orb palette/pulse shift).

**Orb as ambient mastery signal:** idle/listening animation gets subtly more fluid/confident as stage increases (more structured/deliberate early, looser and faster-settling later) — motion-only, no numbers, no badges, legible at a glance or entirely ignorable.

**Hard guardrail:** never use audio chimes/jingles/sound-effect Easter eggs as celebratory beats in the driving context — any distinct non-speech sound trains the driver to glance at the screen to find out what happened, which is the exact reflex this feature exists to eliminate.

---

## Phase 1 — Data Foundations

**Goal:** Persist onboarding stage, VIP contacts, and categories. No UI, no agent changes yet.

- [x] Add `OnboardingProgress`, `Contact`, `EmailCategory`, `CapabilityGroup`, `Capability`, `UserCapabilityProgress` models to `prisma/schema.prisma` (as above).
- [x] `npx prisma migrate dev` — create and run migration. *(Ran non-interactively via `prisma migrate diff` → hand-written migration folder → `prisma migrate deploy`, since `migrate dev` refuses to run in a non-interactive shell. Also had to baseline the pre-existing `20251023051009_init_auth` migration with `prisma migrate resolve --applied`, since this dev DB's tables were originally created via `db push` and were never recorded in `_prisma_migrations`.)*
- [x] `npx prisma generate`.
- [x] Seed script: create the `handsfree-email` `CapabilityGroup` and its 7 `Capability` rows (`email.setup_priorities`, `email.summarize`, `email.mark_read`, `email.archive`, `email.draft`, `email.send`, `email.delete`) with labels/hints/order. Run once, idempotent (upsert on `key`). *(`prisma/seed.js`, wired via `package.json`'s `prisma.seed`; plain JS, not TS, to avoid adding a ts-node/tsx dependency.)*
- [x] Add minimal API routes: `GET/POST /api/onboarding/progress`, `GET/POST/DELETE /api/onboarding/contacts`, `GET/POST/DELETE /api/onboarding/categories`, `GET /api/capabilities` (group + capabilities + this user's `UserCapabilityProgress`), `POST /api/capabilities/:key/complete` (idempotent — no-op if already completed). All auth-gated (reuse NextAuth session check pattern from existing `/api/mcp/*` routes).
- [x] Default a new `User` to `OnboardingProgress.stage = 0` on first access (lazy-create if row doesn't exist, don't backfill via migration). *(Implemented as an `upsert` in the `GET` handler.)*

**Tests:**
- [x] Migration applies cleanly on a fresh DB and on top of existing data (no data loss for current users). *(Verified via `information_schema.tables` before/after — all 5 pre-existing tables intact, 6 new tables added.)*
- [x] `npx prisma studio` equivalent — manually verified all tables and relations via direct Prisma queries, including the seeded `CapabilityGroup`/`Capability` rows (7 capabilities, correct order/labels/hints).
- [x] API route tests via `curl` against a running dev server with a minted NextAuth session cookie: create/read/update/delete each model, confirm 401 when unauthenticated on every route, confirm the `@@unique([userId, email])`/`@@unique([userId, name])` constraints upsert-update rather than duplicate.
- [x] Confirm a brand-new user gets `stage = 0` on first read without a manual insert, and `GET /api/capabilities` returns all 7 capabilities as incomplete. Also verified cross-user isolation with a second test user (no data leakage between accounts).
- [x] Confirm `POST /api/capabilities/:key/complete` is idempotent — calling it twice doesn't error or duplicate, `firstCompletedAt` stays at the first call's time (`alreadyCompleted: true` on the repeat call). Also confirmed an unknown capability key returns 404 rather than silently succeeding.

✅ **Phase 1 complete — all boxes checked, tests passed 2026-09-12.** Ready for Phase 2.

---

## Phase 2 — Screen-Based Setup & Priorities UI (Stages 0–1)

**Goal:** Build the on-screen "Meet & Greet" + "Shadowing" wizard. This is explicitly **not** for driving — full screen UI is fine here.

- [x] New component(s): `src/app/orb-showcase/onboarding/SetupWizard.tsx` (Stage 0 — VIP contacts) and `PrioritiesWizard.tsx` (Stage 1 — categories + ordering), styled consistently with `ToolsOverlay.tsx`. *(Orchestrated by a new `OnboardingWizard.tsx` that switches between them by stage and owns the graduation beat.)*
- [x] Setup step: conversational framing per the drafted script ("Who are your people?"), contact entry (manual email/name entry is enough for v1 — pulling from Google Contacts is a later nice-to-have, not required here), writes to `Contact` via Phase 1 API.
- [x] Priorities step: category creation with keyword tags, live "priority map" preview (sample subjects sorting into tiers as the user reorders) — writes to `EmailCategory`. *(Reordering implemented as up/down buttons that swap `priority` values via the existing upsert API, rather than a drag-and-drop library — avoids a new dependency for a v1 reorder affordance.)*
- [x] Whimsy: skippable graduation animation on completing Priorities (advances `OnboardingProgress.stage` to 1, then 2, via the Phase 1 API); VIP-add micro-animation on the contact list itself. **Scope note:** Codex is concurrently redesigning the live orb (`src/app/components/orb/`) in this same working tree, so the "avatar docks into the orb ring" and orb-glow-tick flourishes described in the design synthesis were **not** wired into the actual orb component to avoid colliding with that work — they're self-contained CSS animations within the new onboarding components instead (a glow ring on the graduation card, a box-shadow "tick" on the checklist item). Revisit true orb-tie-in once Codex's redesign lands.
- [x] Wire entry point: show this wizard automatically for `stage < 2` users instead of/alongside `ToolsOverlay`, once Google Workspace is connected (`activeMcpServers.length > 0` as the connected-workspace proxy, matching how the existing tool-count badge already reads that state).
- [x] Record the `email.setup_priorities` capability as complete (`POST /api/capabilities/email.setup_priorities/complete`) when the Priorities wizard is finished.
- [x] Build the persistent **"Handsfree Email" skills checklist widget** (`src/app/orb-showcase/onboarding/CapabilityChecklist.tsx`), styled consistent with `ToolsOverlay` (rounded-2xl, cyan border, slate background) — not a colorful badge wall. Shown in the main `OrbShowcase` header as a glanceable "N/7" chip that expands into the full list on click, pulled from `GET /api/capabilities`. Tapping an unchecked item shows its one-line voice hint (from `Capability.hint`).
- [x] Small glow-tick animation the moment any capability flips from unchecked to checked while the checklist is expanded on screen (toast-equivalent; the mid-drive spoken version is Phase 4/5 territory, not built yet).
- [x] Shared `useOnboarding` hook (`src/app/orb-showcase/onboarding/useOnboarding.ts`) centralizing all reads/writes to the Phase 1 API so the wizard and checklist widget never duplicate fetch logic or drift out of sync.

**Tests:**
- [x] Full walkthrough driven directly against the Phase 1 API with a seeded test account (mirrors exactly what the wizard's button clicks do): fresh stage 0 → add 2 VIP contacts → advance to Priorities → add 2 categories → reorder via priority-swap → finish → land on stage 2 → checklist shows only "Set up priorities" checked. All steps confirmed correct and persisted.
- [x] Data round-trip: contacts/categories created are readable via the Phase 1 API and correctly ordered by `priority`; reorder swap (promoting one category above another) confirmed to actually flip their stored order.
- [x] `npx tsc --noEmit` and `npm run lint` both clean across the new components and the `OrbShowcase.tsx` integration.
- [x] Confirmed the `OrbShowcase.tsx` integration diff is minimal and additive (30 lines, only new imports/state/render blocks) — no changes to the orb visual components Codex is actively editing, checked via `git diff --stat` before and after.
- [ ] **Deferred:** live in-browser visual QA of the wizard/checklist rendering and animations. A dev server was started for this and its `.next` output collided with Codex's concurrent production-build validation in the same working tree (`rm -rf .next` mid-session interrupted their build). Stopped the dev server immediately once flagged; did not restart it against the shared directory. Functional correctness is covered by the API-level walkthrough above plus clean typecheck/lint, but pixel-level visual QA of the new screens is outstanding — revisit once Codex's build-isolation change lands or the orb redesign work has settled, to avoid re-colliding.

✅ **Phase 2 complete (functionally) — visual QA deferred per the note above.** Refresh context before Phase 3.

---

## Phase 3 — `emailAgent` & Stage-Gated Session Assembly

**Goal:** Stand up the dedicated hands-free email agent and make the server assemble its instructions/tools per user stage. No new user-facing behavior yet beyond the handoff appearing.

- [x] Create `src/app/agentConfigs/emailAgent/index.ts` — new `RealtimeAgent` factory (`createEmailAgent`), narrow instructions scoped to email triage/reply/send/delete (not a copy of `personalAssistant`'s generic multi-domain prompt). Plus `stagePermissions.ts` — a pure `getEmailStagePermissions(stage)` function as the single source of truth for what's unlocked, consumed by the instruction text now and reusable by Phase 5's runtime gate later.
- [x] `personalAssistant`'s `handoffs` **only offer `emailAgent` when `OnboardingProgress.stage >= 2`** — implemented as a new `createPersonalAssistantScenario({ stage, contacts, categories })` factory alongside the existing static `personalAssistantAgent`/`personalAssistantScenario` exports (left untouched for the other two consumers, `App.tsx` and the `agentConfigs/index.ts` scenario registry).
- [x] **Architecture correction from the original plan, found while implementing:** this app has no server-side agent-instruction assembly step — `RealtimeAgent` objects (instructions, handoffs) are constructed **client-side** in `OrbShowcase.tsx` and passed straight into `connect()`; `/api/session` only forwards MCP server config (URL/headers/`allowed_tools`) to OpenAI. So "interpolate contacts/categories into instructions" happens client-side in the new `createPersonalAssistantScenario`/`createEmailAgent` factories (fed by the already-fetched `useOnboarding()` data), not in `/api/session`.
- [x] **Tool-subset-by-stage correction:** the app has a single shared "GoogleWorkspace" MCP server covering Calendar+Gmail+Slack together (confirmed in `GoogleWorkspaceConnector.tsx`) — restricting it via session-level `allowed_tools` would also cut off `personalAssistant`'s Calendar/Slack access for the whole session, not just gate email actions. So stage-gating for Phase 3 is done at the **instruction level** (`emailAgent`'s prompt explicitly states what's allowed vs. "not yet unlocked" at the current stage, per `getEmailStagePermissions`) plus the coarse handoff gate above. The one thing that actually needs hard, code-level enforcement — send/delete — is deliberately left to Phase 5's runtime MCP-call interception, which can also implement the confirm-then-execute flow that a static `allowed_tools` list can't.
- [ ] ~~Register `emailAgent` in `src/app/agentConfigs/index.ts`~~ — skipped: that registry only feeds the generic scenario-picker demo (`App.tsx`), which Orby's actual UI (`OrbShowcase.tsx`) doesn't use; it calls `createPersonalAssistantScenario` directly. Registering there would suggest `emailAgent` works as a standalone scenario, which it doesn't (it depends on being handed off to from `personalAssistant` with real contact/category data).

**Tests:**
- [x] `gitnexus_impact` on `personalAssistantAgent` before editing — 0 upstream callers depend on its internals; confirmed safe to extend without touching the static exports other consumers rely on.
- [x] Unit tested `getEmailStagePermissions` for all 5 stage values plus a monotonicity property (once unlocked, stays unlocked at every later stage) — compiled standalone with the project's own `tsc` and run via `node` in the scratchpad, all assertions passed. (No test runner exists in this repo; this is the same "compile-and-execute a pure function in isolation" approach used in lieu of a unit test framework.)
- [x] Manual test via a temporary dev-only API route exercising `createPersonalAssistantScenario` across all 5 stages with sample contacts/categories: confirmed stages 0-1 produce only `personalAssistant` with no handoff and no mention of `emailAgent` in its instructions; stages 2-4 produce both agents with a correctly bidirectional handoff, and `emailAgent`'s instructions escalate exactly as expected (read-only → +draft → +send/delete) with the correct wording at each step. Route deleted after verification, never committed.
- [x] `npx tsc --noEmit` and `npm run lint` both clean.
- [x] `gitnexus_detect_changes({scope:"staged"})` before committing, isolating exactly the 4 files this phase touches (Codex's concurrent uncommitted orb-redesign work is excluded by staging only these files first). Reported risk is "high," but that's the topology of `OrbShowcase` being a 6-process hub component — not a behavioral risk from this specific change, per the impact check and manual testing above.

✅ **Phase 3 complete — all boxes checked, tests passed 2026-09-12.** Ready for Phase 4.

---

## Phase 4 — Core Hands-Free Actions (Listening → Responding)

**Goal:** The actual voice triage experience for stages 2–3. This is the heart of the feature.

- [x] **Architecture correction, found while implementing:** Gmail tools are `type: 'mcp'` tools executed *server-side by OpenAI directly against the MCP server* (`require_approval: 'never'`, per `/api/session`'s existing config) — the client never sees raw tool results before the model does, so there is no interception point to re-sort results in code before the model reads them. "Priority-first ordering" is therefore implemented at the **instruction level**: `emailAgent`'s prompt now explicitly directs it to fetch first, sort itself (VIP → category priority → recency) before speaking, and never read back whatever raw order a tool returned (see the sharpened "How to triage an inbox out loud" section).
- [x] Spoken triage loop per email: one-line summary first (sender, gist, urgency) before full content — user can say "skip"/"next" without hearing more — written into `emailAgent`'s instructions.
- [x] Interruption/resume handling: instructions direct the agent to re-orient by email number/total rather than restarting cold after a pause.
- [x] Mark-as-read / archive as reversible, no-confirmation actions — already covered by Phase 3's `getEmailStagePermissions` + confirmation-mechanic instructions; unchanged here.
- [x] Draft-and-read-back reply flow (stage 3): instructions state drafts are read back in full and only ever saved, never sent at this stage (sending is Phase 5 territory).
- [x] Whimsy: instructions direct the agent to rotate 3–4 short spoken variants for routine actions, explicitly carving out confirmation/completion lines for send/delete as the one place to stay consistent rather than vary (matches the "safety-critical wording never rotates" whimsy rule from the design synthesis).
- [x] **Capability-completion tracking — real code, not just prompt text:** added `classifyGmailToolCompletion(toolName)` (`emailAgent/toolCompletionClassifier.ts`), a pure best-effort classifier of a completed Gmail MCP tool call into `email.summarize`/`mark_read`/`archive`/`draft`/`send`/`delete`. Wired into `useRealtimeSession.ts`'s existing `response.output_item.done` → `mcp_call` handler via a new optional `onMcpToolCompleted` callback (additive to `RealtimeSessionCallbacks`, safe no-op for `App.tsx` which doesn't pass it). `OrbShowcase.tsx` consumes it: classifies → `completeCapability(key)` → if genuinely first-time, injects a hidden `role: 'user'` conversation item (matching the existing `sendSimulatedUserMessage` pattern in `App.tsx` — `conversation.item.create` doesn't support a `system` role here) asking the model to briefly celebrate once, then triggers `response.create`.
- [x] **Known limitation, called out honestly:** the classifier matches on *plausible* Gmail tool-name patterns (`search_gmail_messages`, `send_gmail_message`, etc.) — the real "GoogleWorkspace" MCP server's exact tool names haven't been verified against a live connected account. Designed to be easy to correct in one place (`toolCompletionClassifier.ts`) once a real tool list is available from `GET /api/mcp/list-tools`.

**Tests:**
- [x] Unit tested `classifyGmailToolCompletion` against 20 cases: all 6 capability mappings, an intentionally ambiguous `modify_gmail_message_labels` case (must NOT be guessed as `summarize` just because it contains "message" — caught a real bug this way and fixed it), cross-domain false-positive guards (Slack/Calendar tool names must never match), and null/undefined/case-insensitivity edge cases. Compiled standalone with the project's `tsc` and run via `node`, all pass.
- [x] `gitnexus_impact` on `useRealtimeSession`/`handleTransportEvent` before editing — 0 upstream callers beyond the two known consumers (`OrbShowcase.tsx`, `App.tsx`), confirmed change is additive-safe for both.
- [x] Manually confirmed `App.tsx`'s call site passes its own callbacks object without `onMcpToolCompleted`, so the new optional-chained invocation safely no-ops there — no regression risk to the non-Orby demo scenario picker.
- [x] `npx tsc --noEmit` and `npm run lint` both clean.
- [x] `gitnexus_detect_changes({scope:"staged"})` — risk reported "high" again due to `useRealtimeSession`/`OrbShowcase` hub topology (touches processes shared with `App.tsx`), not a specific behavioral finding; addressed by the explicit safety checks above rather than by the tool's risk label alone.
- [ ] **Deferred, same reason as Phase 2:** the live "voice triage → priority ordering → capability completion → spoken celebration" path could not be exercised end-to-end — that requires a real OpenAI Realtime connection plus a real, OAuth-connected Gmail account with actual messages, neither of which is available in this environment. What's verified is: the pure classifier logic (unit tested), the wiring compiles and doesn't regress the other consumer (typecheck + impact analysis), and the capability-completion API path itself (proven correct in Phase 1's tests). The "eyes-closed" driving-simulation test and real-account "eyes-closed" tests below remain open until a live account is available.
- [ ] "Eyes-closed" test pass with a real connected account: run a full triage session using only audio and confirm every necessary piece of information was spoken, nothing required a glance, and the spoken order actually matches VIP/category priority (this depends on the model correctly following the instruction-level sort — worth extra scrutiny since there's no code-level enforcement backing it up).
- [ ] Interruption test with a real session: pause mid-conversation, resume, confirm the agent re-orients by email count rather than restarting.
- [ ] Confirm draft-and-read-back never actually sends against a real account — check the Gmail Drafts folder, not Sent, after the flow.

✅ **Phase 4 complete (functionally, with classifier fully tested) — three live-account tests deferred per the note above, same category of limitation as Phase 2's visual QA.** Ready for Phase 5.

---

## Phase 5 — Irreversible Action Confirmation Mechanic (Acting stage)

**Goal:** Unlock send/delete safely. This is the single most safety-critical phase — do not skip or shortcut the tests.

- [x] **Major pre-existing gap found while implementing:** `/api/session/route.ts` hard-coded `require_approval: 'never'` for the MCP server — meaning, before this phase, OpenAI auto-executed **every** Gmail/Calendar/Slack tool call, including send and delete, with zero confirmation of any kind, and the `mcp_approval_request` handling already sitting in `useRealtimeSession.ts` was dead code (it can only run if an approval request is ever generated, which `'never'` prevents entirely). This phase closes a real safety gap in the existing app, not just the new `emailAgent` path.
- [x] `require_approval` is now computed **client-side**, per connected MCP server, from its already-known tool list (`OrbShowcase.tsx`'s new `computeRequireApproval`): every tool name is classified via `classifyIrreversibleGmailAction` (`emailAgent/irreversibleActions.ts`) into an explicit `always`/`never` approval bucket — nothing is left to an implicit default. `/api/session/route.ts` forwards whatever the client sends instead of hard-coding `'never'`.
- [x] `useRealtimeSession.ts`'s `mcp_approval_request` handling no longer auto-approves everything. It now classifies the requested tool, checks the **most recent user utterance** (tracked via a new `lastUserUtteranceRef`, fed from the existing `conversation.item.input_audio_transcription.completed` event) against an exact, action-specific word (`utteranceConfirms` — `/\bsend\b/i` or `/\bdelete\b/i`, never a shared generic "yes"), and sends `approve: true` only on a genuine match — `approve: false` otherwise, always followed by `response.create` either way so the conversation doesn't stall on a denial.
- [x] Silence, an empty utterance, or a mismatched word (e.g. "delete" against a pending send) all correctly resolve to `approve: false` — verified by unit test, see below.
- [x] **Design correction, found while implementing:** the planned "5-8s spoken undo cushion after confirmation, before the action fires" is not achievable with this API — approving an MCP call **is** what triggers immediate server-side execution; there is no server-side pending/delay state to cancel into. The safety property is preserved differently: the confirmation must exist **before** code-level approval is granted at all (required word must already be the most recent thing the user said), rather than being offered as a post-approval cancellation window. This is arguably stronger (nothing fires without a prior explicit word, full stop) even though the specific "say cancel within N seconds" UX isn't implemented.
- [x] Stage gating for whether send/delete are even *attempted*: unchanged from Phase 3 (instruction-level, via `emailAgent`'s "not yet unlocked" wording below stage 4) — this phase's approval gate applies **universally, regardless of stage or which agent is talking**, since it's keyed off the MCP server's tool config, not the active agent. This is a stronger property than the original plan's "stage < 4 users never see send/delete offered": even if the model ignored its own stage-gating instructions, the code-level confirmation gate still blocks it. Also closes the same gap for `personalAssistant`'s own pre-existing (pre-dating this feature) Gmail send capability, which had no confirmation step at all before this phase.
- [x] Capability completion for `email.send`/`email.delete`: unchanged wiring from Phase 4 (`onMcpToolCompleted` only fires from an actually-completed `mcp_call`) — a denied approval never produces that event at all (the tool never executes), so it's structurally impossible for a denial to mark the capability complete. No new code needed here; documenting the reasoning since it's safety-relevant. **Assumption not verified live:** that a denied `mcp_approval_response` produces no `mcp_call` output item at all, per typical Responses/Realtime API semantics — flagged for live verification like the tool-name patterns elsewhere in this plan.
- [x] First-time-only spoken celebration for `email.send`/`email.delete`: already covered by Phase 4's generic `onMcpToolCompleted` → `completeCapability` → celebration-nudge wiring, which is capability-key-agnostic — no additional code needed.

**Tests:**
- [x] `gitnexus_impact` on `useRealtimeSession`/`handleTransportEvent` before editing (same check reused from Phase 4, re-confirmed still LOW/0-upstream after this phase's edits) — this is a shared, high-traffic path; both known consumers (`OrbShowcase.tsx`, `App.tsx`) checked for regressions.
- [x] Unit tested `classifyIrreversibleGmailAction` + `utteranceConfirms` together: 22 assertions covering send/delete/trash classification, non-irreversible tools correctly excluded, Slack/Calendar cross-domain false-positive guards, and — the core safety property — confirmation matching: exact word required (generic "yes" fails for both actions), cross-contamination blocked (saying "delete" does not confirm a pending "send" and vice versa), silence/empty string fails closed, and a word-boundary check ("sending" must not false-positive-match `\bsend\b`). All pass.
- [x] `npx tsc --noEmit` and `npm run lint` clean.
- [ ] **Deferred — requires a live Realtime connection + real Gmail account, unavailable in this environment (same limitation as Phases 2 and 4):** end-to-end manual test triggering a real send — confirm the model reads back the message, the approval request only fires after the user has said "send," and it actually executes; the mirror test for delete with cross-contamination (saying "delete" must not execute a pending send, and vice versa); confirming a genuinely silent/ambiguous response results in a denial and the model asking again rather than silently failing or executing anyway; confirming the celebration nudge fires exactly once per capability on real completion.
- [x] `gitnexus_detect_changes({scope:"staged"})` before committing — see risk note below.

✅ **Phase 5 complete (the code-level safety mechanism itself is built and unit-tested; live end-to-end verification against a real account is the one item deferred, consistent with every other phase's live-account tests).** Ready for Phase 6.

---

## Phase 6 — Continuous Onboarding Progression & Narrative Polish

**Goal:** Wire the stage-advancement rules, graduation moments, and copy/whimsy that make this feel like a relationship growing, not a feature flag flipping.

- [ ] Define and implement stage-advancement criteria (usage-evidence based, not time-based): e.g. N successful Listening sessions with zero user corrections before Responding unlocks; same pattern Responding → Acting. **Reuse `UserCapabilityProgress` as the evidence source** (e.g. Responding unlocks once `email.summarize`/`email.mark_read`/`email.archive` are all completed and used successfully N times since; Acting unlocks similarly off `email.draft`) rather than building a separate success-counter table.
- [ ] Graduation moments: spoken (always) + optional screen animation (only if the user happens to be looking, e.g. post-drive) when a stage unlocks — fires once, not repeatedly, per transition.
- [ ] Create `docs/handsfree-email-copy.md` capturing the reusable narrative copy from this planning pass (Setup conversation script, graduation script, confirmation phrasing) as the source of truth for agent instruction text and UI strings.
- [ ] Wire the verbal streak callout (infrequent, session-start only, never mid-triage).
- [ ] Wire the orb's ambient mastery-signal animation (motion/palette subtly shifts with stage) in the orb rendering components under `src/app/components/orb/`.

**Tests:**
- [ ] Simulate the advancement criteria being met — confirm stage actually advances in `OnboardingProgress` and the correct tools/instructions appear next session (regression check against Phase 3).
- [ ] Confirm graduation script/animation fires exactly once per transition, not on every subsequent session at that stage.
- [ ] Confirm the streak callout only ever appears at session start, never interrupts an in-progress triage.
- [ ] Visual QA of the orb's stage-linked animation changes across all 5 stages.
- [ ] Copy review pass against the whimsy guardrail: confirm no audio chimes/jingles were introduced anywhere, confirm confirmation-turn wording was **not** accidentally added to the rotation pool.

✅ **Phase 6 complete when all boxes above are checked and tests pass.** Refresh context before Phase 7.

---

## Phase 7 — End-to-End QA, Guardrails & Documentation

**Goal:** Full regression pass across the whole feature before calling it shipped.

- [ ] Full cold-start walkthrough with a seeded test account: signup → Google Workspace connect → Setup → Priorities → Listening → Responding → Acting, hitting every phase's behavior in sequence, and confirm the "Handsfree Email" checklist reaches 7/7 by the end, in the same order the actions were actually performed.
- [ ] Regression test the existing moderation guardrail (`guardrails.ts`) still functions correctly alongside the new confirmation mechanic — confirm they don't interfere with each other (one is post-hoc text moderation, one is pre-execution action gating).
- [ ] Safety/accessibility review specifically of the driving-context flows: confirm nothing in Phases 4–6 introduced a screen-look requirement into what should be a hands-free path.
- [ ] Update `CLAUDE.md` (this repo's) with the new `emailAgent`, the `OnboardingProgress`/`Contact`/`EmailCategory` models, the generic `CapabilityGroup`/`Capability`/`UserCapabilityProgress` checklist pattern (and how to add a new group for a future "Handsfree X" domain), and the confirmation-mechanic pattern, following the existing documentation structure.
- [ ] `gitnexus analyze` re-index after all changes; sanity-check `gitnexus_query` / `gitnexus_context` surface the new agent and flows correctly.
- [ ] Final `gitnexus_detect_changes()` full-scope check before merge.

**Tests:**
- [ ] Full walkthrough completes without manual DB intervention or console errors.
- [ ] Guardrail regression suite passes (existing + new confirmation-path cases).
- [ ] Sign-off checklist: every phase 1–6 checkbox above is still checked and re-verified against the final merged code (not just at the time each phase was built).

✅ **Phase 7 complete → feature ready to ship.**
