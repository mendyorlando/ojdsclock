import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeRangeStats, startOfMonth } from "@/lib/hours";
import { tagLabel } from "@/lib/tags";

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function csvField(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  }

  const now = new Date();
  const { searchParams } = new URL(req.url);
  const from = parseDateParam(searchParams.get("from"), startOfMonth(now));
  const toRaw = parseDateParam(searchParams.get("to"), now);
  const to = new Date(toRaw);
  to.setDate(to.getDate() + 1);

  const teachers = await prisma.user.findMany({ where: { role: "TEACHER" }, orderBy: { name: "asc" } });
  const rows = await Promise.all(
    teachers.map(async (t) => ({ user: t, ...(await computeRangeStats(t.id, from, to, now)) })),
  );

  const tagIds = Array.from(new Set(rows.flatMap((r) => Object.keys(r.byTag)))).sort();

  const header = ["Name", "Username", "Pay type", "Days worked", "Total hours", ...tagIds.map(tagLabel)];
  const lines = [header.map(csvField).join(",")];

  for (const r of rows) {
    const line = [
      r.user.name,
      r.user.username,
      r.user.payType === "HOURLY" ? "Hourly" : "Job",
      String(r.daysWorked),
      String(r.hours),
      ...tagIds.map((tagId) => String(r.byTag[tagId] ?? 0)),
    ];
    lines.push(line.map(csvField).join(","));
  }

  const csv = lines.join("\n");
  const fromLabel = from.toISOString().slice(0, 10);
  const toLabel = toRaw.toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ojds-hours-${fromLabel}-to-${toLabel}.csv"`,
    },
  });
}
