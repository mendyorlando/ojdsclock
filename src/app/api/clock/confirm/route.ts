import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeYearStats } from "@/lib/hours";

/**
 * Clocks the current user out, without a physical tag tap - used by the
 * mobile app's geofence-exit reminder ("looks like you left, clock out?").
 * Only actually creates an event if they're currently clocked in; tapping
 * the reminder when there's nothing open is a harmless no-op, same as
 * the existing web long-shift-reminder confirmation flow it mirrors.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const last = await prisma.clockEvent.findFirst({
    where: { userId: user.id },
    orderBy: { timestamp: "desc" },
  });

  const now = new Date();

  if (!last || last.type !== "IN") {
    const year = await computeYearStats(user.id, now);
    return NextResponse.json({
      type: "OUT",
      timestamp: (last?.timestamp ?? now).toISOString(),
      duplicate: true,
      tag: "reminder-confirm",
      hoursThisMonth: year.hoursThisMonth,
      hoursThisYear: year.hoursThisYear,
      streak: null,
      milestone: null,
    });
  }

  const created = await prisma.clockEvent.create({
    data: { userId: user.id, type: "OUT", tagId: "reminder-confirm", timestamp: now },
  });
  const year = await computeYearStats(user.id, now);

  return NextResponse.json({
    type: created.type,
    timestamp: created.timestamp.toISOString(),
    duplicate: false,
    tag: created.tagId,
    hoursThisMonth: year.hoursThisMonth,
    hoursThisYear: year.hoursThisYear,
    streak: null,
    milestone: null,
  });
}
