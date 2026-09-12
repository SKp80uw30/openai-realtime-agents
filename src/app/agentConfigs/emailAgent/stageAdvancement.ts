import { ONBOARDING_STAGE, OnboardingStage } from '@/app/types/onboarding';

// Usage-evidence thresholds for auto-advancing the trust ladder. Named
// constants so they're easy to tune without hunting through logic. Chosen
// as a reasonable starting point, not derived from real usage data yet.
export const RESPONDING_UNLOCK_USES = 5;
export const ACTING_UNLOCK_USES = 5;

const RESPONDING_PREREQUISITES = ['email.summarize', 'email.mark_read', 'email.archive'] as const;
const ACTING_PREREQUISITE = 'email.draft';

// Given the user's current stage and a map of capability key -> use count,
// returns the stage they should be on. Only ever advances one step per call
// (mirrors how it's invoked: once per capability-completion event, against
// the stage as currently known) — never skips a stage in one evaluation.
export function computeAdvancedStage(
  currentStage: OnboardingStage,
  useCounts: Record<string, number>,
): OnboardingStage {
  if (currentStage === ONBOARDING_STAGE.Listening) {
    const ready = RESPONDING_PREREQUISITES.every((key) => (useCounts[key] ?? 0) >= RESPONDING_UNLOCK_USES);
    if (ready) return ONBOARDING_STAGE.Responding;
  }
  if (currentStage === ONBOARDING_STAGE.Responding) {
    const ready = (useCounts[ACTING_PREREQUISITE] ?? 0) >= ACTING_UNLOCK_USES;
    if (ready) return ONBOARDING_STAGE.Acting;
  }
  return currentStage;
}
