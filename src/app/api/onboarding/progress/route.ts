import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import prisma from "@/app/lib/prisma";

const MIN_STAGE = 0;
const MAX_STAGE = 4;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const progress = await prisma.onboardingProgress.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id, stage: MIN_STAGE },
  });

  return NextResponse.json({ stage: progress.stage, updatedAt: progress.updatedAt });
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
  if (typeof stage !== "number" || !Number.isInteger(stage) || stage < MIN_STAGE || stage > MAX_STAGE) {
    return NextResponse.json(
      { error: `stage must be an integer between ${MIN_STAGE} and ${MAX_STAGE}` },
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
