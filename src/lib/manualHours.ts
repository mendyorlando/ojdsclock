import { prisma } from "@/lib/prisma";
import { pairEvents } from "@/lib/hours";

type Interval = { start: Date; end: Date };

/**
 * Given a requested [start, end) range and a list of already-recorded busy
 * ranges, returns the sub-ranges of the request that are NOT already
 * covered. Used so approving a correction, or an admin adding hours, only
 * ever adds the additional time, never duplicates time already on record.
 */
export function subtractBusyIntervals(target: Interval, busy: Interval[]): Interval[] {
  const relevant = busy
    .filter((b) => b.end > target.start && b.start < target.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const free: Interval[] = [];
  let cursor = target.start;

  for (const b of relevant) {
    const bs = b.start.getTime() < cursor.getTime() ? cursor : b.start;
    const be = b.end.getTime() > target.end.getTime() ? target.end : b.end;
    if (bs.getTime() > cursor.getTime()) {
      free.push({ start: cursor, end: bs });
    }
    if (be.getTime() > cursor.getTime()) {
      cursor = be;
    }
  }

  if (cursor.getTime() < target.end.getTime()) {
    free.push({ start: cursor, end: target.end });
  }

  return free;
}

async function existingSessionsOn(userId: string, dayStart: Date, dayEnd: Date): Promise<Interval[]> {
  // Look a bit before/after the target day too, in case an open shift spans
  // midnight, so it still counts as "busy" time to subtract.
  const lookStart = new Date(dayStart.getTime() - 24 * 3_600_000);
  const lookEnd = new Date(dayEnd.getTime() + 24 * 3_600_000);

  const events = await prisma.clockEvent.findMany({
    where: { userId, timestamp: { gte: lookStart, lt: lookEnd } },
    orderBy: { timestamp: "asc" },
  });

  const sessions: Interval[] = [];
  let open: Date | null = null;
  for (const ev of events) {
    if (ev.type === "IN") {
      open = ev.timestamp;
    } else if (ev.type === "OUT" && open) {
      sessions.push({ start: open, end: ev.timestamp });
      open = null;
    }
  }
  if (open) {
    // Still clocked in with no end yet; treat as busy through the query window.
    sessions.push({ start: open, end: lookEnd });
  }
  return sessions;
}

export type AddHoursResult = { added: Interval[]; skippedFullyOverlapping: boolean };

/**
 * Adds new IN/OUT clock events for whatever part of [start, end) isn't
 * already covered by existing sessions. Used for both an admin adding
 * hours directly, and for approving a teacher's correction request.
 */
export async function addAdditionalHours(
  userId: string,
  start: Date,
  end: Date,
  tagId: string,
): Promise<AddHoursResult> {
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(end.getTime());

  const busy = await existingSessionsOn(userId, dayStart, dayEnd);
  const free = subtractBusyIntervals({ start, end }, busy);

  for (const interval of free) {
    if (interval.end.getTime() - interval.start.getTime() < 60_000) continue; // skip slivers under a minute
    await prisma.clockEvent.create({
      data: { userId, type: "IN", timestamp: interval.start, tagId },
    });
    await prisma.clockEvent.create({
      data: { userId, type: "OUT", timestamp: interval.end, tagId },
    });
  }

  return { added: free, skippedFullyOverlapping: free.length === 0 };
}

export type ApplyHourResult =
  | { mode: "replaced"; hours: number }
  | { mode: "added"; added: Interval[]; skippedFullyOverlapping: boolean };

/**
 * Like addAdditionalHours, but first checks the day as a whole: if the new
 * entry represents FEWER hours than are already on record for that day,
 * it's treated as a correction of a wrong total rather than more time to
 * add, so the day's existing events are replaced outright with the new
 * entry instead of layering on top of them. Otherwise, falls back to only
 * adding the non-overlapping remainder, same as before.
 */
export async function applyHourEntry(
  userId: string,
  start: Date,
  end: Date,
  tagId: string,
): Promise<ApplyHourResult> {
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const dayEvents = await prisma.clockEvent.findMany({
    where: { userId, timestamp: { gte: dayStart, lt: dayEnd } },
    orderBy: { timestamp: "asc" },
  });

  // Pair with the real current time, not the requested end, so a shift
  // that's genuinely still open right now is recognized as such rather
  // than treated as if it had already ended at the requested end time.
  const [existingDay] = pairEvents(dayEvents, new Date());
  const existingHours = existingDay?.hours ?? 0;
  const requestedHours = (end.getTime() - start.getTime()) / 3_600_000;

  // Never let a correction silently close out and delete a shift that's
  // genuinely still in progress; fall back to only adding the
  // non-overlapping remainder instead, same as the "more hours" case.
  if (requestedHours < existingHours && !existingDay?.inProgress) {
    await prisma.clockEvent.deleteMany({ where: { userId, timestamp: { gte: dayStart, lt: dayEnd } } });
    await prisma.clockEvent.create({ data: { userId, type: "IN", timestamp: start, tagId } });
    await prisma.clockEvent.create({ data: { userId, type: "OUT", timestamp: end, tagId } });
    return { mode: "replaced", hours: Math.round(requestedHours * 10) / 10 };
  }

  const result = await addAdditionalHours(userId, start, end, tagId);
  return { mode: "added", ...result };
}
