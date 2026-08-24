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

  // Only the same physical tag read twice in quick succession (a phone
  // bouncing the NFC read) counts as an accidental duplicate; a genuine
  // tap on a different door within the window is a real, distinct event.
  if (last && last.tagId === tagId && now.getTime() - last.timestamp.getTime() < DUPLICATE_WINDOW_MS) {
    return { type: last.type, timestamp: last.timestamp, duplicate: true };
  }

  const nextType = last?.type === "IN" ? "OUT" : "IN";

  const created = await prisma.clockEvent.create({
    data: { userId, tagId, type: nextType, timestamp: now },
  });

  return { type: created.type, timestamp: created.timestamp, duplicate: false };
}
