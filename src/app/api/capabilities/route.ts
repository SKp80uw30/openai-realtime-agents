import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import prisma from "@/app/lib/prisma";

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

  return NextResponse.json({
    group: { key: group.key, label: group.label },
    capabilities: group.capabilities.map((capability) => ({
      key: capability.key,
      label: capability.label,
      hint: capability.hint,
      order: capability.order,
      completed: completedIds.has(capability.id),
      firstCompletedAt: completedAtByCapabilityId.get(capability.id) ?? null,
    })),
  });
}
