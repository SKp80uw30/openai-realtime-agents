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

- [ ] Create `src/app/agentConfigs/emailAgent/index.ts` — new `RealtimeAgent`, narrow instructions scoped to email triage/reply/send/delete (not a copy of `personalAssistant`'s generic multi-domain prompt).
- [ ] Add `emailAgent` to `personalAssistant`'s `handoffs` array, but **only expose/offer it when `OnboardingProgress.stage >= 2`** — checked server-side, not left to the model.
- [ ] In `/api/session`, read `OnboardingProgress.stage` + `Contact` + `EmailCategory` for the authenticated user and:
  - Interpolate VIP contacts/categories into `emailAgent`'s instructions (priority ordering rules, spoken-summary style).
  - Select the tool subset by stage:
    ```
    stage 2 (Listening):  gmail read/search/list only
    stage 3 (Responding): + reply-draft (read-back, not sent), mark-read, archive
    stage 4 (Acting):     + send, delete/trash (behind Phase 5's confirmation gate)
    ```
- [ ] Register `emailAgent` in `src/app/agentConfigs/index.ts` per the existing "Adding New Agent Scenarios" pattern in `CLAUDE.md`.

**Tests:**
- [ ] `gitnexus_impact` on `personalAssistant`'s instructions/handoffs before editing (per repo's GitNexus policy) — confirm no unexpected callers, report risk level.
- [ ] Unit test the stage→tool-selection function directly (pure function, easy to test in isolation) for all 5 stage values.
- [ ] Manual test: seed a test user at each stage (0, 2, 3, 4) and confirm via session logs that only the correct tool subset and instruction content is sent to the Realtime API.
- [ ] Manual test: confirm `personalAssistant` does **not** offer/attempt the `emailAgent` handoff for a stage-0 or stage-1 user, and does for stage ≥ 2.
- [ ] `gitnexus_detect_changes()` before committing — confirm only expected symbols/flows changed.

✅ **Phase 3 complete when all boxes above are checked and tests pass.** Refresh context before Phase 4.

---

## Phase 4 — Core Hands-Free Actions (Listening → Responding)

**Goal:** The actual voice triage experience for stages 2–3. This is the heart of the feature.

- [ ] Priority-first ordering: `emailAgent` queries inbox, sorts by VIP contact match → category priority → recency, and enforces this order in how it presents emails (don't rely on the model to re-derive ordering from raw tool results each time — pass pre-sorted context where practical).
- [ ] Spoken triage loop per email: one-line summary first (sender, gist, urgency) before full content — user can say "skip"/"next" without hearing more. Design so a user can bail early (per the "no skimming in audio" research finding).
- [ ] Interruption/resume handling: session should be able to answer "where was I?" and re-orient (which email number, of how many, from which priority tier) rather than restarting cold after a pause.
- [ ] Mark-as-read / archive as reversible, no-confirmation actions.
- [ ] Draft-and-read-back reply flow (stage 3): agent drafts, reads it back in full, and only *saves as draft* — does not send (sending is stage 4 / Phase 5 territory).
- [ ] Whimsy: rotate 3–4 short spoken variants for routine confirmations of action ("Got it, filing that away" / "Archived — one less thing"), small pool, no sound effects.
- [ ] Record capability completion on first successful use, via `POST /api/capabilities/:key/complete`: `email.summarize` (first spoken triage summary given), `email.mark_read`, `email.archive`, `email.draft` (first draft read back to the user). Fire-and-forget from the tool-execution path — never blocks or narrates the API call itself.
- [ ] First-time-only spoken celebration line when one of these flips to complete mid-drive (e.g. "That's your first hands-free reply — nice."), per the storyteller's graduation-moment tone — distinct from the routine action-confirmation phrases above, and only ever said once per capability.

**Tests:**
- [ ] Seeded test inbox with a mix of VIP/non-VIP senders and categorized subjects — verify spoken order matches expected priority ranking.
- [ ] "Eyes-closed" test pass: run a full triage session using only audio (no looking at the screen) and confirm every necessary piece of information was spoken, nothing required a glance.
- [ ] Interruption test: pause mid-session (simulate a 5–10s gap), resume, confirm Orby correctly re-orients instead of restarting or losing place.
- [ ] Confirm mark-read/archive never trigger a confirmation prompt (regression guard against over-confirming).
- [ ] Confirm draft-and-read-back never actually sends — check Gmail drafts folder, not sent mail, after the flow.
- [ ] Whimsy phrase rotation observed across a multi-email session — variety present but not distracting or repeated absurdly often.
- [ ] Confirm each of `email.summarize` / `email.mark_read` / `email.archive` / `email.draft` flips to complete on first genuine use, the celebration line fires exactly once per capability (not on the 2nd+ use), and the checklist widget (Phase 2) reflects the new state next time it's viewed.

✅ **Phase 4 complete when all boxes above are checked and tests pass.** Refresh context before Phase 5.

---

## Phase 5 — Irreversible Action Confirmation Mechanic (Acting stage)

**Goal:** Unlock send/delete safely. This is the single most safety-critical phase — do not skip or shortcut the tests.

- [ ] Extend the MCP tool-call-approval interception in `useRealtimeSession.ts` with a hard-coded allowlist of irreversible tool names (`gmail_send`, `gmail_delete`, `gmail_trash`, etc.) — classification is code-level, never model-judged.
- [ ] On a matched call: withhold execution, synthesize a spoken confirmation turn with the action word stated up front and a **distinct confirmation phrase per action type** (e.g. "say send" vs. "say delete" — never a shared generic "yes").
- [ ] Treat silence or any non-matching utterance as "no" — no timeout-based auto-confirm.
- [ ] Add the 5–8s spoken undo cushion after confirmation, before the action actually fires ("Sending... say cancel now to stop"), with an actual cancel path that stops execution.
- [ ] Gate `send`/`delete` tools being present at all behind `stage === 4` (already partially wired in Phase 3's tool-selection function — this phase adds the runtime enforcement layer on top).
- [ ] Record `email.send` / `email.delete` capability completion **only after the action genuinely fires** (i.e. after the undo cushion elapses without cancellation) — a cancelled send/delete must never mark the capability complete, since the point of the checklist is "you actually did this," not "you attempted it."
- [ ] First-time-only spoken celebration line for `email.send`/`email.delete`, same one-shot rule as Phase 4's capabilities.

**Tests:**
- [ ] `gitnexus_impact` on `useRealtimeSession.ts`'s tool-call interception before editing — this is a shared, high-traffic path; confirm risk level and report to user if HIGH/CRITICAL.
- [ ] Unit test the irreversible-action classifier against the full current Gmail tool list — confirm exactly the intended set matches, nothing else.
- [ ] Manual test: trigger a send — confirm the spoken gate fires, confirm affirmative phrase executes it, confirm ambiguous/silent response does not.
- [ ] Manual test: trigger a delete — same, with the delete-specific phrase, confirm send's phrase does *not* also confirm a delete (cross-contamination check).
- [ ] Manual test: use the undo cushion to cancel a send/delete after confirming — confirm the action genuinely does not fire.
- [ ] Confirm stage < 4 users never see send/delete tools offered at all (defense in depth on top of Phase 3's gating).
- [ ] Confirm cancelling via the undo cushion does **not** mark `email.send`/`email.delete` complete in the checklist; confirm a genuine send/delete does.
- [ ] `gitnexus_detect_changes()` before committing.

✅ **Phase 5 complete when all boxes above are checked and tests pass.** Refresh context before Phase 6.

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
