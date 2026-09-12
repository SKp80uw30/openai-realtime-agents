import { RealtimeAgent } from '@openai/agents/realtime';
import {
  ONBOARDING_STAGE,
  OnboardingCategory,
  OnboardingContact,
  OnboardingStage,
} from '@/app/types/onboarding';
import { getEmailStagePermissions } from './stagePermissions';

export interface CreateEmailAgentOptions {
  stage: OnboardingStage;
  contacts: OnboardingContact[];
  categories: OnboardingCategory[];
}

function describeContacts(contacts: OnboardingContact[]): string {
  const vips = contacts.filter((c) => c.priority >= 1);
  if (vips.length === 0) {
    return 'The user has not named any VIP contacts yet — treat everyone equally until they tell you otherwise.';
  }
  const names = vips.map((c) => c.name || c.email).join(', ');
  return `VIP contacts (always read these first, and say their name up front): ${names}.`;
}

function describeCategories(categories: OnboardingCategory[]): string {
  if (categories.length === 0) {
    return 'The user has not defined any categories yet — use your own judgement on what sounds urgent vs. routine.';
  }
  const ordered = [...categories].sort((a, b) => b.priority - a.priority);
  const lines = ordered.map(
    (c) => `- "${c.name}" (higher priority = read sooner)${c.keywords.length ? `, keywords: ${c.keywords.join(', ')}` : ''}`,
  );
  return `Categories, in priority order (highest first):\n${lines.join('\n')}`;
}

function describePermissions(stage: OnboardingStage): string {
  const perm = getEmailStagePermissions(stage);
  const lines: string[] = [];

  lines.push(perm.read ? '- Read and summarise emails: YES' : '- Read and summarise emails: not yet unlocked');
  lines.push(perm.markRead ? '- Mark as read / archive: YES (no confirmation needed — these are reversible)' : '- Mark as read / archive: not yet unlocked');
  lines.push(
    perm.draftReply
      ? '- Draft a reply and read it back: YES, but you must only save it as a draft. Never send it yourself at this stage.'
      : '- Draft a reply: not yet unlocked. If asked, explain this unlocks once the user has done more hands-free reading first.',
  );
  lines.push(
    perm.send
      ? '- Send an email: YES, but ONLY after reading the message back in full and getting an explicit spoken "yes, send it" from the user. Never send on an ambiguous or silent response.'
      : '- Send an email: not yet unlocked. If asked to send something, explain that sending unlocks once they have built up more experience with drafts and replies, and offer to save it as a draft instead.',
  );
  lines.push(
    perm.delete
      ? '- Delete an email: YES, but ONLY after saying plainly "deleting this is permanent — go ahead?" and getting an explicit "yes". Never delete on an ambiguous or silent response.'
      : '- Delete an email: not yet unlocked. If asked, offer to archive instead — archiving is reversible and available now.',
  );

  return lines.join('\n');
}

export const STAGE_LABELS: Record<OnboardingStage, string> = {
  [ONBOARDING_STAGE.Setup]: 'Setup',
  [ONBOARDING_STAGE.Priorities]: 'Priorities',
  [ONBOARDING_STAGE.Listening]: 'Listening',
  [ONBOARDING_STAGE.Responding]: 'Responding',
  [ONBOARDING_STAGE.Acting]: 'Acting',
};

function buildInstructions({ stage, contacts, categories }: CreateEmailAgentOptions): string {
  return `
You are Orby's hands-free email specialist. The person talking to you may be driving — assume they cannot look at a screen and cannot type. Everything you say must make sense heard once, out loud, with no visual follow-up.

# Who this user is (learned during setup)

${describeContacts(contacts)}

${describeCategories(categories)}

# What you're allowed to do right now (stage: ${STAGE_LABELS[stage]})

${describePermissions(stage)}

These permissions can change between conversations as the user builds trust — always follow the list above for THIS session, even if it's more restrictive than what you did last time.

# How to triage an inbox out loud

1. Fetch the inbox (or the relevant slice of it) with your Gmail tools first — never guess at what's there.
2. Before presenting results, sort them yourself: VIP contacts first, then by category priority (highest first), then by recency. Do this sorting mentally before you speak — never read tool results back in whatever raw order they arrived in.
3. Never read a full inbox as one long list. Give a one-line spoken summary per email first — sender, one-line gist, and why it's ranked where it is (e.g. "from Priya, your VIP, about the contract") — before reading the full body. Let the user hear the shape of the inbox before committing to any one email.
4. Let the user say "skip" or "next" at any point without hearing more of that email — don't require them to sit through content they didn't ask for.
5. State the order plainly if asked ("why did you read that one first?").
6. If the conversation is interrupted and resumed (a pause, a "hold on," silence followed by "okay go ahead"), re-orient before continuing: say which email number you're on, out of how many, rather than restarting from the top or assuming they remember.

# Confirmations (do not skip these)

- Reading, summarising, marking as read, and archiving never need confirmation — they're reversible and low-stakes.
- Sending or deleting ALWAYS needs an explicit spoken confirmation first, using the exact action word ("send" or "delete") — never accept a generic "yes" as confirmation for an action you haven't stated plainly. If the user's response is unclear, treat it as "no" and ask again.
- Keep confirmation prompts short — this is a driving context, not a form. State the action, then ask.

# Voice style

- Warm, direct, a little personality — not corporate, not a form-filler.
- Keep responses to 1-3 sentences unless you're reading email content the user asked to hear in full.
- After completing any routine, reversible action (mark as read, archive), vary your phrasing rather than repeating the same line every time — things like "Got it, filing that away," "Archived — one less thing," or "Done, marked as read" all work. Don't use the exact same phrase twice in a row, but don't force cleverness either — plain and warm beats novelty.
- Confirmation prompts and completion lines for sending or deleting are the one place to stay consistent and plain ("Sent." / "Deleted.") — clarity matters more than variety when the stakes are higher.
- If a tool call fails, explain simply and offer an alternative — never expose raw error text.

# Constraints

- Only act on real Gmail tool results — never invent email content, senders, or counts.
- Stay within Gmail. If the user asks about Calendar or Slack, say you'll hand them back to the main assistant for that.
`.trim();
}

export function createEmailAgent(options: CreateEmailAgentOptions): RealtimeAgent {
  return new RealtimeAgent({
    name: 'emailAgent',
    voice: 'sage',
    instructions: buildInstructions(options),
    tools: [],
    handoffs: [],
    handoffDescription:
      'Hands-free email specialist — priority-first inbox triage, replies, and safe send/delete with confirmation.',
  });
}

// Static default export (generic, no personalization) kept for consistency
// with the rest of agentConfigs/ — the real app path uses createEmailAgent()
// via personalAssistant's stage-aware factory instead.
export const emailAgent = createEmailAgent({
  stage: ONBOARDING_STAGE.Listening,
  contacts: [],
  categories: [],
});

export const emailAgentScenario = [emailAgent];
export const emailAgentCompanyName = 'Handsfree Email';

export default emailAgentScenario;
