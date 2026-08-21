import { prisma } from "@/lib/prisma";

const DUPLICATE_WINDOW_MS = 15_000;

export type ToggleResult = {
  type: "IN" | "OUT";
  timestamp: Date;
  duplicate: boolean;
};

export async function toggleClock(userId: string, tagId: string): Promise<ToggleResult> {
  const last = await prisma.clockEvent.findFirst({
    where: { userId },
    orderBy: { timestamp: "desc" },
  });

  const now = new Date();

  if (last && now.getTime() - last.timestamp.getTime() < DUPLICATE_WINDOW_MS) {
    return { type: last.type, timestamp: last.timestamp, duplicate: true };
  }

  const nextType = last?.type === "IN" ? "OUT" : "IN";

  const created = await prisma.clockEvent.create({
    data: { userId, tagId, type: nextType, timestamp: now },
  });

  return { type: created.type, timestamp: created.timestamp, duplicate: false };
}
