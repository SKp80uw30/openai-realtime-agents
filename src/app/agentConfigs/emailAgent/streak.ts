// Normalizes to UTC midnight so "same day / yesterday / a gap" comparisons
// don't depend on time-of-day or timezone.
export function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface StreakUpdate {
  streakDays: number;
  lastActiveDate: Date;
  changed: boolean;
}

// Computes the new streak state for "the user showed up today." Called once
// per session-start (GET /api/onboarding/progress), not per-action, so it's
// safe to call multiple times within the same calendar day without inflating
// the streak (changed: false in that case).
export function computeStreakUpdate(
  previousStreakDays: number,
  lastActiveDate: Date | null,
  now: Date,
): StreakUpdate {
  const today = toUtcDateOnly(now);

  if (!lastActiveDate) {
    return { streakDays: 1, lastActiveDate: today, changed: true };
  }

  const previousDay = toUtcDateOnly(lastActiveDate);
  const dayDiff = Math.round((today.getTime() - previousDay.getTime()) / ONE_DAY_MS);

  if (dayDiff === 0) {
    // Already counted today — no-op, avoids double-incrementing across
    // multiple connects/reloads in the same session or day.
    return { streakDays: previousStreakDays, lastActiveDate: previousDay, changed: false };
  }
  if (dayDiff === 1) {
    return { streakDays: previousStreakDays + 1, lastActiveDate: today, changed: true };
  }
  // A gap of more than one day breaks the streak.
  return { streakDays: 1, lastActiveDate: today, changed: true };
}
