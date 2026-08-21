import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleClock } from "@/lib/clock";
import { computeYearStats, computeStreak } from "@/lib/hours";
import { distanceMeters, schoolLocation } from "@/lib/geo";

export async function POST(req: NextRequest, context: { params: Promise<{ tag: string }> }) {
  const { tag } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (user.role === "ADMIN") {
    return NextResponse.json({ error: "not_an_employee" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  const school = schoolLocation();
  if (school) {
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: "no_location" }, { status: 400 });
    }
    const distance = distanceMeters(lat, lng, school.lat, school.lng);
    if (distance > school.radiusMeters) {
      return NextResponse.json({ error: "too_far", distanceMeters: Math.round(distance) }, { status: 403 });
    }
  }

  const result = await toggleClock(user.id, tag);
  const now = new Date();
  const year = await computeYearStats(user.id, now);
  const streak = result.type === "IN" ? await computeStreak(user.id, now) : null;

  return NextResponse.json({
    type: result.type,
    timestamp: result.timestamp.toISOString(),
    duplicate: result.duplicate,
    tag,
    hoursThisMonth: year.hoursThisMonth,
    hoursThisYear: year.hoursThisYear,
    streak,
  });
}
