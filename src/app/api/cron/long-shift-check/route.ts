import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkLongShifts } from "@/lib/push";

// Called two ways:
//  - by a scheduled job (e.g. Vercel Cron) with `Authorization: Bearer <CRON_SECRET>`
//  - manually by a signed-in admin, from the admin dashboard
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  const hasValidSecret = Boolean(expected) && authHeader === `Bearer ${expected}`;

  if (!hasValidSecret) {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await checkLongShifts();
  return NextResponse.json(result);
}
