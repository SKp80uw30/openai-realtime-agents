import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import prisma from "@/app/lib/prisma";
import { computeAdvancedStage } from "@/app/agentConfigs/emailAgent/stageAdvancement";
import { toUtcDateOnly } from "@/app/agentConfigs/emailAgent/streak";
import { computePracticeSummary } from "@/app/lib/practice";
import { ONBOARDING_STAGE, OnboardingStage } from "@/app/types/onboarding";

export async function POST(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { key } = await params;

  const capability = await prisma.capability.findUnique({ where: { key } });
  if (!capability) {
    return NextResponse.json({ error: `Unknown capability "${key}"` }, { status: 404 });
  }

  // Idempotent for the checklist's purposes (firstCompletedAt only ever set
  // once), but every genuine call — including the first — increments
  // useCount/lastUsedAt, since stage-advancement needs "how many times since,"
  // not just "at least once."
  const existing = await prisma.userCapabilityProgress.findUnique({
    where: { userId_capabilityId: { userId, capabilityId: capability.id } },
  });

  const progress = existing
    ? await prisma.userCapabilityProgress.update({
        where: { userId_capabilityId: { userId, capabilityId: capability.id } },
        data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
      })
    : await prisma.userCapabilityProgress.create({
        data: { userId, capabilityId: capability.id },
      });

  // Record that this group was used hands-free today. One row per calendar
  // day: the practice tier ladder counts distinct days, so twenty uses in one
  // sitting advance it exactly as far as one does — which is the point.
  const today = toUtcDateOnly(new Date());
  const existingDay = await prisma.capabilityPracticeDay.findUnique({
    where: {
      userId_groupId_day: { userId, groupId: capability.groupId, day: today },
    },
  });
  await prisma.capabilityPracticeDay.upsert({
    where: {
      userId_groupId_day: { userId, groupId: capability.groupId, day: today },
    },
    update: { uses: { increment: 1 } },
    create: { userId, groupId: capability.groupId, day: today },
  });

  // Stage-advancement check: only relevant capability groups need this, but
  // it's cheap enough to just always check — pull every capability use-count
  // for this user's group and see if the current stage's criteria are met.
  const onboarding = await prisma.onboardingProgress.upsert({
    where: { userId },
    update: {},
    create: { userId, stage: ONBOARDING_STAGE.Listening },
  });

  const groupProgress = await prisma.userCapabilityProgress.findMany({
    where: { userId, capability: { groupId: capability.groupId } },
    include: { capability: true },
  });
  const useCounts: Record<string, number> = {};
  for (const row of groupProgress) {
    useCounts[row.capability.key] = row.useCount;
  }

  const currentStage = onboarding.stage as OnboardingStage;
  const nextStage = computeAdvancedStage(currentStage, useCounts);
  const stageAdvanced = nextStage !== currentStage;

  if (stageAdvanced) {
    await prisma.onboardingProgress.update({
      where: { userId },
      data: { stage: nextStage },
    });
  }

  // Practice tier, before and after this call, so the client knows whether to
  // celebrate a tier-up. "Before" is reconstructed by subtracting exactly what
  // this call added: the step, if it was the first time, and today, if today
  // wasn't already an active day.
  const totalSteps = await prisma.capability.count({ where: { groupId: capability.groupId } });
  const practiceDayRows = await prisma.capabilityPracticeDay.findMany({
    where: { userId, groupId: capability.groupId },
    select: { day: true },
    orderBy: { day: "asc" },
  });
  const practiceDays = practiceDayRows.map((row) => row.day);
  const stepsCompleted = groupProgress.length;
  const now = new Date();

  const practiceAfter = computePracticeSummary({ stepsCompleted, totalSteps, practiceDays, now });
  const practiceBefore = computePracticeSummary({
    stepsCompleted: existing ? stepsCompleted : stepsCompleted - 1,
    totalSteps,
    practiceDays: existingDay
      ? practiceDays
      : practiceDays.filter((day) => day.getTime() !== today.getTime()),
    now,
  });
  const tierAdvanced = practiceAfter.tier.key !== practiceBefore.tier.key;

  return NextResponse.json({
    key: capability.key,
    completed: true,
    firstCompletedAt: progress.firstCompletedAt,
    useCount: progress.useCount,
    alreadyCompleted: Boolean(existing),
    stage: nextStage,
    stageAdvanced,
    tier: { key: practiceAfter.tier.key, label: practiceAfter.tier.label, blurb: practiceAfter.tier.blurb },
    tierAdvanced,
    activeDays: practiceAfter.activeDays,
    currentStreak: practiceAfter.currentStreak,
  });
}
