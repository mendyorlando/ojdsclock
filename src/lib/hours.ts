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

async function closedDateSet(from: Date, to: Date): Promise<Set<string>> {
  const closures = await prisma.schoolClosure.findMany({
    where: { date: { gte: from, lt: to } },
  });
  return new Set(closures.map((c) => startOfDay(c.date).toDateString()));
}

// Pulled out of computeStreak() so computeAdminOverview() can reuse it
// against a single already-fetched batch of events for every teacher,
// rather than each teacher re-running this same query pair.
function streakFromDays(days: DayHours[], closed: Set<string>, now: Date): number {
  // A day counts as worked once there's a session on it, even one that
  // just started seconds ago and rounds to 0.0 hours so far, otherwise the
  // very moment someone clocks in, "today" looks unworked and the streak
  // undercounts by one right when it's shown on the tap-confirmation screen.
  const worked = new Map(days.map((d) => [d.dateKey, d.hours > 0 || d.inProgress]));

  let streak = 0;
  const cursor = startOfDay(now);

  if (!worked.get(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }

  // Saturday and Sunday are both excluded, as is any date on the school's
  // closure calendar (holidays, breaks); missing any of those never
  // breaks the streak.
  for (let i = 0; i < 70; i++) {
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6 || closed.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    const didWork = worked.get(cursor.toDateString()) ?? false;
    if (didWork) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export async function computeStreak(userId: string, now: Date = new Date()): Promise<number> {
  const lookback = new Date(now);
  lookback.setDate(lookback.getDate() - 70);

  const [events, closed] = await Promise.all([
    fetchEvents(userId, lookback, new Date(now.getTime() + 1)),
    closedDateSet(lookback, new Date(now.getTime() + 1)),
  ]);
  const days = pairEvents(events, now);
  return streakFromDays(days, closed, now);
}

const STREAK_MILESTONES = [7, 30, 100, 180, 365];

export function streakMilestone(streak: number): number | null {
  if (STREAK_MILESTONES.includes(streak)) return streak;
  if (streak > 365 && streak % 365 === 0) return streak;
  return null;
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

  // Recomputed from each session's raw start/end (not the already-rounded
  // day.hours / session.hours) and rounded once at the end, so the total
  // and the per-door breakdown always add up the same way instead of
  // drifting apart from rounding at two different granularities.
  const byTagRaw: Record<string, number> = {};
  let totalRaw = 0;
  for (const day of days) {
    for (const s of day.sessions) {
      const rawHours = ((s.end ?? now).getTime() - s.start.getTime()) / 3_600_000;
      byTagRaw[s.tagId] = (byTagRaw[s.tagId] || 0) + rawHours;
      totalRaw += rawHours;
    }
  }
  const byTag: Record<string, number> = {};
  for (const [tagId, rawHours] of Object.entries(byTagRaw)) byTag[tagId] = round1(rawHours);

  return {
    hours: round1(totalRaw),
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
    where: { role: "TEACHER", active: true },
    orderBy: { name: "asc" },
  });

  // Was 3-4 queries PER teacher (year stats, current status, streak, and a
  // closures lookup that's identical for everyone) fired all at once - fine
  // with a couple of teachers, but the concurrent query count scales
  // linearly with staff size and started queueing behind the database's
  // connection pool once there were enough of them, adding real seconds to
  // every load of this screen. Fetching every teacher's events and the one
  // shared closures list just once, then computing each row in memory,
  // keeps this at exactly 2 queries no matter how many staff there are.
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);
  const streakLookback = new Date(now);
  streakLookback.setDate(streakLookback.getDate() - 70);
  const rangeStart = streakLookback < yearStart ? streakLookback : yearStart;
  const tomorrow = new Date(startOfDay(now));
  tomorrow.setDate(tomorrow.getDate() + 1);

  const teacherIds = teachers.map((t) => t.id);
  const [allEvents, closed] = await Promise.all([
    prisma.clockEvent.findMany({
      where: { userId: { in: teacherIds }, timestamp: { gte: rangeStart, lt: tomorrow } },
      orderBy: { timestamp: "asc" },
    }),
    closedDateSet(streakLookback, new Date(now.getTime() + 1)),
  ]);

  const eventsByUser = new Map<string, typeof allEvents>();
  for (const ev of allEvents) {
    const list = eventsByUser.get(ev.userId);
    if (list) list.push(ev);
    else eventsByUser.set(ev.userId, [ev]);
  }

  const rows: AdminRow[] = teachers.map((user) => {
    const events = eventsByUser.get(user.id) ?? [];
    const days = pairEvents(events, now);

    const year: YearStats = {
      hoursThisWeek: round1(sum(days.filter((d) => d.date >= weekStart).map((d) => d.hours))),
      hoursThisMonth: round1(sum(days.filter((d) => d.date >= monthStart).map((d) => d.hours))),
      hoursThisYear: round1(sum(days.filter((d) => d.date >= yearStart).map((d) => d.hours))),
      daysThisYear: days.filter((d) => d.date >= yearStart && d.hours > 0).length,
    };

    // Bounded by the same 70-day/year-start window as everything else here
    // (unlike the single-teacher isCurrentlyClockedIn, which has no date
    // bound) - someone whose last real clock event is older than that has
    // a stuck-open session that's already worth an admin's attention for
    // other reasons, so this is a reasonable trade for not needing a third
    // per-teacher query.
    const currentlyIn = events.length > 0 && events[events.length - 1].type === "IN";
    const streak = streakFromDays(days, closed, now);

    return { user, ...year, currentlyIn, streak };
  });

  const totalStaff = rows.length;
  const clockedInNow = rows.filter((r) => r.currentlyIn).length;
  const totalHoursThisWeek = round1(sum(rows.map((r) => r.hoursThisWeek)));
  const totalHoursThisMonth = round1(sum(rows.map((r) => r.hoursThisMonth)));
  const avgHoursThisMonth = totalStaff > 0 ? round1(totalHoursThisMonth / totalStaff) : 0;
  const topStreak = rows.reduce((max, r) => Math.max(max, r.streak), 0);

  return { rows, totalStaff, clockedInNow, totalHoursThisWeek, totalHoursThisMonth, avgHoursThisMonth, topStreak };
}
