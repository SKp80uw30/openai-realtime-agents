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
  completed: boolean;
  firstCompletedAt: string | null;
}

export interface CapabilityGroupStatus {
  group: { key: string; label: string };
  capabilities: CapabilityStatus[];
}
