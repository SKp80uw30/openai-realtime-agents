import { toUtcDateOnly } from '@/app/agentConfigs/emailAgent/streak';

// Practice depth model — the answer to "ticking all seven once is not a new way
// of working."
//
// The checklist's n/7 is a *repertoire* measure: it says which of the skills
// you've ever done hands-free, and it's rightly one-shot — you only discover a
// capability once. It is deliberately NOT a mastery measure, and on its own it
// closes the loop far too early: a user who summarised one inbox and sent one
// email sees 7/7 and a green tick, having changed nothing about how they work.
//
// So depth is tracked on two further axes, both orthogonal to the repertoire:
//
//   1. Fluency, per skill — how many times that one skill has been used. Turns
//      "done" into "tried / practised / fluent", so a single use never reads as
//      mastery of that skill.
//   2. Tier, per group — how many distinct *days* the user has worked
//      hands-free. This is the axis that actually corresponds to the claim the
//      product makes (28% of the workweek, screen-free); it can only be earned
//      by showing up repeatedly, and unlike a raw use-count it can't be
//      inflated by one long cramming session.
//
// Distinct days rather than total uses is the deliberate choice: habit research
// (Lally et al. 2010, UCL) finds automaticity comes from repetition in a
// consistent context over time — median ~66 days, and doing something twenty
// times in one afternoon does not build it. The tier thresholds below are taken
// from that literature rather than invented, which is why they're much longer
// than a typical onboarding checklist.
//
// Generic on purpose: nothing here is email-specific, so a future
// "Handsfree Calendar" group gets the same ladder for free.

export interface PracticeTier {
  key: string;
  label: string;
  /** What reaching this tier actually means — shown under the badge. */
  blurb: string;
  /** Requires every step in the group to have been done at least once. */
  requiresAllSteps: boolean;
  /** Minimum distinct steps used at least once. */
  minSteps: number;
  /** Minimum distinct calendar days on which the group was used hands-free. */
  minDays: number;
}

// Ordered lowest to highest. Tuning these is a copy/threshold decision, not a
// structural one — the compute below just walks the list.
export const PRACTICE_TIERS: PracticeTier[] = [
  {
    key: 'novice',
    label: 'Novice',
    blurb: 'You’ve got the map. Nothing proven hands-free yet.',
    requiresAllSteps: false,
    minSteps: 0,
    minDays: 0,
  },
  {
    key: 'apprentice',
    label: 'Apprentice',
    blurb: 'First skill done by voice. Six more to meet.',
    requiresAllSteps: false,
    minSteps: 1,
    minDays: 1,
  },
  {
    key: 'practitioner',
    label: 'Practitioner',
    blurb: 'All seven, done hands-free. Now the real work: making it the default instead of the demo.',
    requiresAllSteps: true,
    minSteps: 0,
    minDays: 3,
  },
  {
    key: 'habitual',
    label: 'Habit forming',
    blurb: 'Three weeks of hands-free days. The reach for the keyboard is starting to fade.',
    requiresAllSteps: true,
    minSteps: 0,
    minDays: 21,
  },
  {
    key: 'second-nature',
    label: 'Second nature',
    blurb:
      'Sixty-six hands-free days — the research median for a habit becoming automatic. Email is now something you do, not somewhere you sit.',
    requiresAllSteps: true,
    minSteps: 0,
    minDays: 66,
  },
];

export interface FluencyLevel {
  key: 'new' | 'tried' | 'practised' | 'fluent';
  label: string;
  minUses: number;
}

// Per-skill depth. The gap between "tried" and "fluent" is what stops a single
// successful utterance from being presented as a solved problem.
export const FLUENCY_LEVELS: FluencyLevel[] = [
  { key: 'new', label: 'Not yet', minUses: 0 },
  { key: 'tried', label: 'Tried', minUses: 1 },
  { key: 'practised', label: 'Practised', minUses: 5 },
  { key: 'fluent', label: 'Fluent', minUses: 15 },
];

export function computeFluency(useCount: number): FluencyLevel {
  let level = FLUENCY_LEVELS[0];
  for (const candidate of FLUENCY_LEVELS) {
    if (useCount >= candidate.minUses) level = candidate;
  }
  return level;
}

/** Uses still needed to reach the next fluency level, or null at the top. */
export function usesToNextFluency(useCount: number): { next: FluencyLevel; remaining: number } | null {
  const next = FLUENCY_LEVELS.find((level) => useCount < level.minUses);
  return next ? { next, remaining: next.minUses - useCount } : null;
}

export interface PracticeSummary {
  /** Distinct calendar days with at least one hands-free use. */
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  tier: PracticeTier;
  nextTier: PracticeTier | null;
  /** What's still missing for nextTier — null when already at the top. */
  toNextTier: { days: number; steps: number } | null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function meetsTier(tier: PracticeTier, stepsCompleted: number, totalSteps: number, activeDays: number): boolean {
  if (tier.requiresAllSteps && (totalSteps === 0 || stepsCompleted < totalSteps)) return false;
  if (stepsCompleted < tier.minSteps) return false;
  return activeDays >= tier.minDays;
}

// Streaks are computed from the raw day list rather than stored incrementally,
// so they stay correct regardless of when this is called and need no
// "did we already count today" bookkeeping. A streak is only broken by a full
// missed day: today not yet being used doesn't end yesterday's run, since
// resetting someone's streak at midnight for a day still in progress punishes
// them for time rather than behaviour.
export function computePracticeSummary(input: {
  stepsCompleted: number;
  totalSteps: number;
  practiceDays: Date[];
  now: Date;
}): PracticeSummary {
  const { stepsCompleted, totalSteps, practiceDays, now } = input;

  const uniqueDayTimes = Array.from(
    new Set(practiceDays.map((day) => toUtcDateOnly(day).getTime())),
  ).sort((a, b) => a - b);

  const activeDays = uniqueDayTimes.length;

  let longestStreak = 0;
  let runLength = 0;
  for (let i = 0; i < uniqueDayTimes.length; i += 1) {
    const isConsecutive = i > 0 && uniqueDayTimes[i] - uniqueDayTimes[i - 1] === ONE_DAY_MS;
    runLength = isConsecutive ? runLength + 1 : 1;
    if (runLength > longestStreak) longestStreak = runLength;
  }

  // The trailing run only counts as *current* if it reaches today or yesterday.
  let currentStreak = 0;
  if (activeDays > 0) {
    const today = toUtcDateOnly(now).getTime();
    const lastDay = uniqueDayTimes[uniqueDayTimes.length - 1];
    const gap = Math.round((today - lastDay) / ONE_DAY_MS);
    if (gap <= 1) {
      currentStreak = 1;
      for (let i = uniqueDayTimes.length - 1; i > 0; i -= 1) {
        if (uniqueDayTimes[i] - uniqueDayTimes[i - 1] !== ONE_DAY_MS) break;
        currentStreak += 1;
      }
    }
  }

  let tier = PRACTICE_TIERS[0];
  for (const candidate of PRACTICE_TIERS) {
    if (meetsTier(candidate, stepsCompleted, totalSteps, activeDays)) tier = candidate;
  }

  const tierIndex = PRACTICE_TIERS.findIndex((t) => t.key === tier.key);
  const nextTier = PRACTICE_TIERS[tierIndex + 1] ?? null;

  const toNextTier = nextTier
    ? {
        days: Math.max(0, nextTier.minDays - activeDays),
        steps: Math.max(
          0,
          (nextTier.requiresAllSteps ? totalSteps : nextTier.minSteps) - stepsCompleted,
        ),
      }
    : null;

  return { activeDays, currentStreak, longestStreak, tier, nextTier, toNextTier };
}
