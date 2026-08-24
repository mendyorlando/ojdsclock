import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseCsvLine } from "@/lib/csv";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    const url = new URL("/admin/calendar", req.url);
    url.searchParams.set("error", "Choose a CSV file first.");
    return NextResponse.redirect(url, { status: 303 });
  }

  const text = await file.text();
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

  const url = new URL("/admin/calendar", req.url);
  url.searchParams.set("added", String(added));
  if (skipped > 0) url.searchParams.set("skipped", String(skipped));
  return NextResponse.redirect(url, { status: 303 });
}
