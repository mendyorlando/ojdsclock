import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCsvLine } from "@/lib/csv";

/** JSON equivalent of src/app/admin/calendar/upload/route.ts. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const text = String(body?.csv || "");
  if (!text) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let added = 0;
  let skipped = 0;

  for (const line of lines) {
    const [rawDate, rawLabel] = parseCsvLine(line);
    if (!rawDate || rawDate.toLowerCase() === "date") continue; // header row

    const date = new Date(`${rawDate.trim()}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      skipped += 1;
      continue;
    }

    const label = (rawLabel || "").trim();
    await prisma.schoolClosure.upsert({
      where: { date },
      update: { label: label || null },
      create: { date, label: label || null },
    });
    added += 1;
  }

  return NextResponse.json({ added, skipped });
}
