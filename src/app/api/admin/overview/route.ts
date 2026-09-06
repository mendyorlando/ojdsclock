import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { computeAdminOverview } from "@/lib/hours";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const overview = await computeAdminOverview();

  return NextResponse.json({
    totalStaff: overview.totalStaff,
    clockedInNow: overview.clockedInNow,
    totalHoursThisWeek: overview.totalHoursThisWeek,
    totalHoursThisMonth: overview.totalHoursThisMonth,
    avgHoursThisMonth: overview.avgHoursThisMonth,
    topStreak: overview.topStreak,
    rows: overview.rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      title: r.user.title,
      currentlyIn: r.currentlyIn,
      streak: r.streak,
      hoursThisWeek: r.hoursThisWeek,
      hoursThisMonth: r.hoursThisMonth,
      hoursThisYear: r.hoursThisYear,
    })),
  });
}
