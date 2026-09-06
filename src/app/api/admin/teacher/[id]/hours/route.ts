import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyHourEntry } from "@/lib/manualHours";

/** JSON equivalent of src/app/admin/teacher/[id]/actions.ts's addHoursAction. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "TEACHER") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const date = String(body?.date || "");
  const startTime = String(body?.startTime || "");
  const endTime = String(body?.endTime || "");

  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await applyHourEntry(id, start, end, "manual-entry");

  return NextResponse.json({ ok: true });
}
