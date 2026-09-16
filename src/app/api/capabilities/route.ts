import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import prisma from "@/app/lib/prisma";
import { computeFluency, computePracticeSummary, usesToNextFluency } from "@/app/lib/practice";

const HANDSFREE_EMAIL_GROUP_KEY = "handsfree-email";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const group = await prisma.capabilityGroup.findUnique({
    where: { key: HANDSFREE_EMAIL_GROUP_KEY },
    include: { capabilities: { orderBy: { order: "asc" } } },
  });

  if (!group) {
    return NextResponse.json({ error: "Capability group not seeded" }, { status: 500 });
  }

  const progress = await prisma.userCapabilityProgress.findMany({
    where: { userId: session.user.id, capability: { groupId: group.id } },
  });
  const completedIds = new Set(progress.map((p) => p.capabilityId));
  const completedAtByCapabilityId = new Map(
    progress.map((p) => [p.capabilityId, p.firstCompletedAt]),
  );
  const useCountByCapabilityId = new Map(progress.map((p) => [p.capabilityId, p.useCount]));

  // Every practice day for this group, so streaks are derived rather than
  // stored. Unbounded by design: one small row per active day means even a
  // multi-year user is a few hundred rows, and the whole set is needed for
  // longestStreak anyway.
  const practiceDays = await prisma.capabilityPracticeDay.findMany({
    where: { userId: session.user.id, groupId: group.id },
    select: { day: true },
    orderBy: { day: "asc" },
  });

  const practice = computePracticeSummary({
    stepsCompleted: completedIds.size,
    totalSteps: group.capabilities.length,
    practiceDays: practiceDays.map((row) => row.day),
    now: new Date(),
  });

  return NextResponse.json({
    group: { key: group.key, label: group.label },
    capabilities: group.capabilities.map((capability) => {
      const useCount = useCountByCapabilityId.get(capability.id) ?? 0;
      const fluency = computeFluency(useCount);
      const next = usesToNextFluency(useCount);
      return {
        key: capability.key,
        label: capability.label,
        hint: capability.hint,
        order: capability.order,
        completed: completedIds.has(capability.id),
        firstCompletedAt: completedAtByCapabilityId.get(capability.id) ?? null,
        useCount,
        fluency: fluency.key,
        fluencyLabel: fluency.label,
        usesToNextFluency: next?.remaining ?? null,
      };
    }),
    practice: {
      activeDays: practice.activeDays,
      currentStreak: practice.currentStreak,
      longestStreak: practice.longestStreak,
      tier: {
        key: practice.tier.key,
        label: practice.tier.label,
        blurb: practice.tier.blurb,
        minDays: practice.tier.minDays,
      },
      nextTier: practice.nextTier
        ? {
            key: practice.nextTier.key,
            label: practice.nextTier.label,
            blurb: practice.nextTier.blurb,
            minDays: practice.nextTier.minDays,
          }
        : null,
      toNextTier: practice.toNextTier,
    },
  });
}
