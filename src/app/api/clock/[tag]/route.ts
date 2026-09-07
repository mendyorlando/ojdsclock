import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleClock } from "@/lib/clock";
import { computeYearStats, computeStreak, streakMilestone } from "@/lib/hours";
import { verifyTap } from "@/lib/nfcTags";
import { checkWithinSchoolRadius } from "@/lib/geo";
import { TAG_LABELS } from "@/lib/tags";

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
  const piccData = String(body?.piccData || "");
  const cmac = String(body?.cmac || "");
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  let label: string;

  if (piccData && cmac) {
    const verified = await verifyTap(piccData, cmac, tag);
    if (!verified.ok) {
      return NextResponse.json({ error: verified.reason }, { status: 403 });
    }
    label = verified.label;
  } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
    if (!(tag in TAG_LABELS)) {
      return NextResponse.json({ error: "invalid" }, { status: 403 });
    }
    const geo = checkWithinSchoolRadius(lat, lng, user.school);
    if (!geo.ok) {
      return NextResponse.json({ error: geo.reason }, { status: 403 });
    }
    label = tag;
  } else {
    return NextResponse.json({ error: "invalid" }, { status: 403 });
  }

  const result = await toggleClock(user.id, label);
  const now = new Date();
  const year = await computeYearStats(user.id, now);
  const streak = result.type === "IN" ? await computeStreak(user.id, now) : null;
  const milestone = streak !== null && !result.duplicate ? streakMilestone(streak) : null;

  return NextResponse.json({
    type: result.type,
    timestamp: result.timestamp.toISOString(),
    duplicate: result.duplicate,
    tag: label,
    hoursThisMonth: year.hoursThisMonth,
    hoursThisYear: year.hoursThisYear,
    streak,
    milestone,
  });
}
