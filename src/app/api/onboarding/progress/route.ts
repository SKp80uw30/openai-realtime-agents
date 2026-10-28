import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import prisma from "@/app/lib/prisma";
import { computeStreakUpdate } from "@/app/agentConfigs/emailAgent/streak";
import { ONBOARDING_STAGE } from "@/app/types/onboarding";

const LISTENING_STAGE = ONBOARDING_STAGE.Listening;
const MAX_STAGE = 4;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const progress = await prisma.onboardingProgress.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id, stage: LISTENING_STAGE },
  });

  // "The user showed up today" — computed on every GET (app load), not per
  // action. computeStreakUpdate no-ops (changed: false) for repeat loads
  // within the same calendar day, so this is safe to call on every mount.
  const streak = computeStreakUpdate(progress.streakDays, progress.lastActiveDate, new Date());
  const stage = Math.max(progress.stage, LISTENING_STAGE);
  const finalProgress = streak.changed || stage !== progress.stage
    ? await prisma.onboardingProgress.update({
        where: { userId: session.user.id },
        data: {
          stage,
          ...(streak.changed
            ? { streakDays: streak.streakDays, lastActiveDate: streak.lastActiveDate }
            : {}),
        },
      })
    : progress;

  return NextResponse.json({
    stage: finalProgress.stage,
    updatedAt: finalProgress.updatedAt,
    streakDays: finalProgress.streakDays,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { stage?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stage = body.stage;
  if (typeof stage !== "number" || !Number.isInteger(stage) || stage < 0 || stage > MAX_STAGE) {
    return NextResponse.json(
      { error: `stage must be an integer between 0 and ${MAX_STAGE}` },
      { status: 400 },
    );
  }

  const progress = await prisma.onboardingProgress.upsert({
    where: { userId: session.user.id },
    update: { stage },
    create: { userId: session.user.id, stage },
  });

  return NextResponse.json({ stage: progress.stage, updatedAt: progress.updatedAt });
}
