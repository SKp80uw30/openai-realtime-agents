import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import prisma from "@/app/lib/prisma";
import { computeAdvancedStage } from "@/app/agentConfigs/emailAgent/stageAdvancement";
import { OnboardingStage } from "@/app/types/onboarding";

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

  // Stage-advancement check: only relevant capability groups need this, but
  // it's cheap enough to just always check — pull every capability use-count
  // for this user's group and see if the current stage's criteria are met.
  const onboarding = await prisma.onboardingProgress.upsert({
    where: { userId },
    update: {},
    create: { userId },
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

  return NextResponse.json({
    key: capability.key,
    completed: true,
    firstCompletedAt: progress.firstCompletedAt,
    useCount: progress.useCount,
    alreadyCompleted: Boolean(existing),
    stage: nextStage,
    stageAdvanced,
  });
}
