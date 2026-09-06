import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeRangeStats, startOfMonth } from "@/lib/hours";

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/** Admin-only: hours-by-teacher over a date range, mirrors /admin/reports. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const now = new Date();
  const { searchParams } = new URL(req.url);
  const from = parseDateParam(searchParams.get("from"), startOfMonth(now));
  const toRaw = parseDateParam(searchParams.get("to"), now);
  const to = new Date(toRaw);
  to.setDate(to.getDate() + 1); // make the "to" date inclusive

  const teachers = await prisma.user.findMany({ where: { role: "TEACHER" }, orderBy: { name: "asc" } });
  const rows = await Promise.all(
    teachers.map(async (t) => {
      const stats = await computeRangeStats(t.id, from, to, now);
      return {
        id: t.id,
        name: t.name,
        payType: t.payType,
        daysWorked: stats.daysWorked,
        hours: stats.hours,
      };
    }),
  );

  const totalHours = Math.round(rows.reduce((sum, r) => sum + r.hours, 0) * 10) / 10;

  return NextResponse.json({
    from: from.toISOString().slice(0, 10),
    to: toRaw.toISOString().slice(0, 10),
    totalHours,
    rows,
  });
}
