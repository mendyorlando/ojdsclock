import { prisma } from "@/lib/prisma";

const TAGS = ["chabad-door", "ojds-door"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Wipes this user's clock history and correction requests, then fills in
 * several months of realistic, randomized fake attendance so every metric,
 * report, and streak in the app has something real to look at. Meant for a
 * dedicated test/demo teacher account, not a real one, since it deletes
 * whatever was there first.
 */
export async function generateDemoHistory(userId: string, now: Date = new Date()) {
  await prisma.correctionRequest.deleteMany({ where: { userId } });
  await prisma.clockEvent.deleteMany({ where: { userId } });

  const daysBack = 130;
  const start = new Date(now);
  start.setDate(start.getDate() - daysBack);
  start.setHours(0, 0, 0, 0);

  const events: { userId: string; type: "IN" | "OUT"; timestamp: Date; tagId: string }[] = [];
  let streakBreakInserted = false;

  for (let i = 0; i <= daysBack; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const dow = day.getDay();
    const isToday = i === daysBack;

    if (dow === 6) continue; // Saturday off entirely

    // Sprinkle in occasional missed days for a realistic, imperfect streak,
    // but never on the most recent few days so the demo streak reads well.
    const daysFromToday = daysBack - i;
    if (!isToday && daysFromToday > 5 && Math.random() < 0.08) {
      streakBreakInserted = true;
      continue;
    }

    const tagId = pick(TAGS);
    const inHour = 7;
    const inMinute = Math.floor(rand(45, 75)); // 7:45-8:15ish, spills into hour+1 sometimes
    const clockIn = new Date(day);
    clockIn.setHours(inHour, 0, 0, 0);
    clockIn.setMinutes(inMinute);

    if (isToday) {
      // Leave today as an open shift so "currently clocked in" has something to show.
      events.push({ userId, type: "IN", timestamp: clockIn, tagId });
      continue;
    }

    const longDay = Math.random() < 0.1;
    const outHour = longDay ? 17 : 15;
    const outMinute = Math.floor(rand(0, 45));
    const clockOut = new Date(day);
    clockOut.setHours(outHour, 0, 0, 0);
    clockOut.setMinutes(outMinute);

    events.push({ userId, type: "IN", timestamp: clockIn, tagId });
    events.push({ userId, type: "OUT", timestamp: clockOut, tagId });
  }

  if (events.length > 0) {
    await prisma.clockEvent.createMany({ data: events });
  }

  // A few sample correction requests, one of each status, so the Requests
  // flow has something to review too.
  const sampleDay = new Date(now);
  sampleDay.setDate(sampleDay.getDate() - 10);
  while (sampleDay.getDay() === 6 || sampleDay.getDay() === 0) sampleDay.setDate(sampleDay.getDate() - 1);

  const makeRange = (dayOffset: number, startH: number, endH: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOffset);
    const s = new Date(d);
    s.setHours(startH, 0, 0, 0);
    const e = new Date(d);
    e.setHours(endH, 0, 0, 0);
    return { s, e };
  };

  const pending = makeRange(3, 16, 17);
  const approved = makeRange(20, 17, 18);
  const denied = makeRange(35, 12, 13);

  await prisma.correctionRequest.createMany({
    data: [
      {
        userId,
        requestedStart: pending.s,
        requestedEnd: pending.e,
        reason: "Forgot to tap out after staying to help set up for an event.",
        status: "PENDING",
      },
      {
        userId,
        requestedStart: approved.s,
        requestedEnd: approved.e,
        reason: "Stayed late for a parent meeting, tag wasn't working.",
        status: "APPROVED",
        resolvedAt: new Date(now.getTime() - 19 * 86_400_000),
      },
      {
        userId,
        requestedStart: denied.s,
        requestedEnd: denied.e,
        reason: "Thought I clocked in but must have missed the tap.",
        status: "DENIED",
        resolvedAt: new Date(now.getTime() - 34 * 86_400_000),
      },
    ],
  });

  return { daysGenerated: events.length / 2, hadGap: streakBreakInserted };
}
