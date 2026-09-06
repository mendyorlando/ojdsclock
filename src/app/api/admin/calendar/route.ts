import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "@/lib/hours";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const today = startOfDay(new Date());
  const [upcoming, past] = await Promise.all([
    prisma.schoolClosure.findMany({ where: { date: { gte: today } }, orderBy: { date: "asc" } }),
    prisma.schoolClosure.findMany({ where: { date: { lt: today } }, orderBy: { date: "desc" }, take: 20 }),
  ]);

  const serialize = (c: (typeof upcoming)[number]) => ({
    id: c.id,
    date: c.date.toISOString().slice(0, 10),
    label: c.label,
  });

  return NextResponse.json({ upcoming: upcoming.map(serialize), past: past.map(serialize) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const dateStr = String(body?.date || "");
  const label = String(body?.label || "").trim();

  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await prisma.schoolClosure.upsert({
    where: { date },
    update: { label: label || null },
    create: { date, label: label || null },
  });

  return NextResponse.json({ ok: true });
}
