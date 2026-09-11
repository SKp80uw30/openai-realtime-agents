import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import prisma from "@/app/lib/prisma";

export async function POST(_request: Request, { params }: { params: { key: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const capability = await prisma.capability.findUnique({ where: { key: params.key } });
  if (!capability) {
    return NextResponse.json({ error: `Unknown capability "${params.key}"` }, { status: 404 });
  }

  // Idempotent: first call records firstCompletedAt, later calls are a no-op
  // so a capability's completion timestamp always reflects genuine first use.
  const existing = await prisma.userCapabilityProgress.findUnique({
    where: { userId_capabilityId: { userId: session.user.id, capabilityId: capability.id } },
  });

  const progress =
    existing ??
    (await prisma.userCapabilityProgress.create({
      data: { userId: session.user.id, capabilityId: capability.id },
    }));

  return NextResponse.json({
    key: capability.key,
    completed: true,
    firstCompletedAt: progress.firstCompletedAt,
    alreadyCompleted: Boolean(existing),
  });
}
