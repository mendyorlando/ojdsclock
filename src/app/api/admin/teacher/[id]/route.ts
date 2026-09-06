import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeWeekDays, computeStreak, computeYearStats } from "@/lib/hours";

/** Admin-only: a single teacher's hours, mirroring /api/me/summary's shape. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;
  const teacher = await prisma.user.findUnique({ where: { id } });
  if (!teacher || teacher.role !== "TEACHER") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const now = new Date();
  const [days, streak, year, pendingRequests] = await Promise.all([
    computeWeekDays(teacher.id, now),
    computeStreak(teacher.id, now),
    computeYearStats(teacher.id, now),
    prisma.correctionRequest.findMany({
      where: { userId: teacher.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    name: teacher.name,
    username: teacher.username,
    title: teacher.title,
    payType: teacher.payType,
    hasBoundDevice: teacher.boundDeviceId !== null,
    pendingRequests: pendingRequests.map((r) => ({
      id: r.id,
      requestedStart: r.requestedStart.toISOString(),
      requestedEnd: r.requestedEnd.toISOString(),
      reason: r.reason,
    })),
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
