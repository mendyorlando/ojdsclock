import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { computeWeekDays, computeStreak, computeYearStats } from "@/lib/hours";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const now = new Date();
  const [days, streak, year] = await Promise.all([
    computeWeekDays(user.id, now),
    computeStreak(user.id, now),
    computeYearStats(user.id, now),
  ]);

  return NextResponse.json({
    days: days.map((d) => ({
      label: d.label,
      date: d.date.toISOString(),
      isToday: d.isToday,
      isFuture: d.isFuture,
      hours: d.hours,
      inProgress: d.inProgress,
      sessions: d.sessions.map((s) => ({
        tagId: s.tagId,
        start: s.start.toISOString(),
        end: s.end ? s.end.toISOString() : null,
        hours: s.hours,
      })),
    })),
    streak,
    ...year,
    currentlyIn: days.some((d) => d.inProgress),
  });
}
