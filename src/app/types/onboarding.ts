export const ONBOARDING_STAGE = {
  Setup: 0,
  Priorities: 1,
  Listening: 2,
  Responding: 3,
  Acting: 4,
} as const;

export type OnboardingStage = typeof ONBOARDING_STAGE[keyof typeof ONBOARDING_STAGE];

export interface OnboardingContact {
  id: string;
  email: string;
  name?: string | null;
  priority: number;
}

export interface OnboardingCategory {
  id: string;
  name: string;
  keywords: string[];
  priority: number;
}

export interface CapabilityStatus {
  key: string;
  label: string;
  hint: string;
  order: number;
  /** Ever done hands-free. Repertoire, not mastery — see `useCount`. */
  completed: boolean;
  firstCompletedAt: string | null;
  /** Total hands-free uses, which is what fluency is derived from. */
  useCount: number;
  fluency: 'new' | 'tried' | 'practised' | 'fluent';
  fluencyLabel: string;
  /** Uses left to reach the next fluency level; null once fluent. */
  usesToNextFluency: number | null;
}

/** Group-level depth: how embedded the habit is, beyond the n/7 repertoire. */
export interface PracticeStatus {
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  tier: { key: string; label: string; blurb: string; minDays: number };
  nextTier: { key: string; label: string; blurb: string; minDays: number } | null;
  toNextTier: { days: number; steps: number } | null;
}

export interface CapabilityGroupStatus {
  group: { key: string; label: string };
  capabilities: CapabilityStatus[];
  practice: PracticeStatus;
}
