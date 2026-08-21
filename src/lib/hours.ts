import { prisma } from "@/lib/prisma";

export type Session = { tagId: string; start: Date; end: Date | null; hours: number };
export type DayHours = { dateKey: string; date: Date; hours: number; inProgress: boolean; sessions: Session[] };

const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDate(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

// The school week runs Sunday through Friday, Saturday off entirely, so
// "week" here means Sunday-start, not the conventional Monday-start.
export function startOfWeek(d: Date) {
  const start = startOfDay(d);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

async function fetchEvents(userId: string, from: Date, to: Date) {
  return prisma.clockEvent.findMany({
    where: { userId, timestamp: { gte: from, lt: to } },
    orderBy: { timestamp: "asc" },
  });
}

type RawEvent = { type: "IN" | "OUT"; timestamp: Date; tagId: string };

export function pairEvents(events: RawEvent[], now: Date): DayHours[] {
  const byDay = new Map<string, DayHours>();
  let open: { start: Date; tagId: string } | null = null;

  const dayFor = (d: Date) => {
    const key = startOfDay(d).toDateString();
    if (!byDay.has(key)) {
      byDay.set(key, { dateKey: key, date: startOfDay(d), hours: 0, inProgress: false, sessions: [] });
    }
    return byDay.get(key)!;
  };

  for (const ev of events) {
    if (ev.type === "IN") {
      open = { start: ev.timestamp, tagId: ev.tagId };
    } else if (ev.type === "OUT" && open) {
      const hrs = (ev.timestamp.getTime() - open.start.getTime()) / 3_600_000;
      const day = dayFor(open.start);
      day.sessions.push({ tagId: open.tagId, start: open.start, end: ev.timestamp, hours: round1(hrs) });
      day.hours += hrs;
      open = null;
    }
  }

  if (open) {
    const hrs = Math.max(0, (now.getTime() - open.start.getTime()) / 3_600_000);
    const day = dayFor(open.start);
    day.sessions.push({ tagId: open.tagId, start: open.start, end: null, hours: round1(hrs) });
    day.hours += hrs;
    day.inProgress = true;
  }

  for (const day of byDay.values()) day.hours = round1(day.hours);

  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type WeekDayRow = {
  label: string;
  date: Date;
  isToday: boolean;
  isFuture: boolean;
  hours: number;
  inProgress: boolean;
  sessions: Session[];
};

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI"];

export async function computeWeekDays(userId: string, now: Date = new Date()): Promise<WeekDayRow[]> {
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const events = await fetchEvents(userId, weekStart, weekEnd);
  const days = pairEvents(events, now);
  const today = startOfDay(now);

  return WEEKDAY_LABELS.map((label, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const found = days.find((d) => isSameDate(d.date, date));
    return {
      label,
      date,
      isToday: isSameDate(date, now),
      isFuture: date.getTime() > today.getTime(),
      hours: found?.hours ?? 0,
      inProgress: found?.inProgress ?? false,
      sessions: found?.sessions ?? [],
    };
  });
}

export async function computeStreak(userId: string, now: Date = new Date()): Promise<number> {
  const lookback = new Date(now);
  lookback.setDate(lookback.getDate() - 70);

  const events = await fetchEvents(userId, lookback, new Date(now.getTime() + 1));
  const days = pairEvents(events, now);
  const worked = new Map(days.map((d) => [d.dateKey, d.hours]));

  let streak = 0;
  const cursor = startOfDay(now);

  if (!worked.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }

  // Saturday and Sunday are both excluded; missing either never breaks the streak.
  for (let i = 0; i < 70; i++) {
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    const hrs = worked.get(cursor.toDateString()) ?? 0;
    if (hrs > 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export type YearStats = {
  hoursThisWeek: number;
  hoursThisMonth: number;
  hoursThisYear: number;
  daysThisYear: number;
};

export async function computeYearStats(userId: string, now: Date = new Date()): Promise<YearStats> {
  const yearStart = startOfYear(now);
  const monthStart = startOfMonth(now);
  const weekStart = startOfWeek(now);
  const tomorrow = new Date(startOfDay(now));
  tomorrow.setDate(tomorrow.getDate() + 1);

  const events = await fetchEvents(userId, yearStart, tomorrow);
  const days = pairEvents(events, now);

  return {
    hoursThisWeek: round1(sum(days.filter((d) => d.date >= weekStart).map((d) => d.hours))),
    hoursThisMonth: round1(sum(days.filter((d) => d.date >= monthStart).map((d) => d.hours))),
    hoursThisYear: round1(sum(days.map((d) => d.hours))),
    daysThisYear: days.filter((d) => d.hours > 0).length,
  };
}

export type RangeStats = {
  hours: number;
  daysWorked: number;
  byTag: Record<string, number>;
  days: DayHours[];
};

export async function computeRangeStats(
  userId: string,
  from: Date,
  to: Date,
  now: Date = new Date(),
): Promise<RangeStats> {
  const events = await fetchEvents(userId, from, to);
  const days = pairEvents(events, now);

  const byTag: Record<string, number> = {};
  for (const day of days) {
    for (const s of day.sessions) {
      byTag[s.tagId] = round1((byTag[s.tagId] || 0) + s.hours);
    }
  }

  return {
    hours: round1(sum(days.map((d) => d.hours))),
    daysWorked: days.filter((d) => d.hours > 0).length,
    byTag,
    days,
  };
}

export async function isCurrentlyClockedIn(userId: string): Promise<boolean> {
  const last = await prisma.clockEvent.findFirst({
    where: { userId },
    orderBy: { timestamp: "desc" },
  });
  return last?.type === "IN";
}

export type AdminRow = YearStats & {
  user: Awaited<ReturnType<typeof prisma.user.findMany>>[number];
  currentlyIn: boolean;
  streak: number;
};

export async function computeAdminOverview(now: Date = new Date()) {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { name: "asc" },
  });

  const rows: AdminRow[] = await Promise.all(
    teachers.map(async (user) => {
      const [year, currentlyIn, streak] = await Promise.all([
        computeYearStats(user.id, now),
        isCurrentlyClockedIn(user.id),
        computeStreak(user.id, now),
      ]);
      return { user, ...year, currentlyIn, streak };
    }),
  );

  const totalStaff = rows.length;
  const clockedInNow = rows.filter((r) => r.currentlyIn).length;
  const totalHoursThisWeek = round1(sum(rows.map((r) => r.hoursThisWeek)));
  const totalHoursThisMonth = round1(sum(rows.map((r) => r.hoursThisMonth)));
  const avgHoursThisMonth = totalStaff > 0 ? round1(totalHoursThisMonth / totalStaff) : 0;
  const topStreak = rows.reduce((max, r) => Math.max(max, r.streak), 0);

  return { rows, totalStaff, clockedInNow, totalHoursThisWeek, totalHoursThisMonth, avgHoursThisMonth, topStreak };
}
