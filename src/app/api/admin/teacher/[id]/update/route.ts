import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** JSON equivalent of src/app/admin/teacher/[id]/actions.ts's updateTeacherInfo. */
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
  const name = String(body?.name || "").trim();
  const username = String(body?.username || "").trim().toLowerCase();
  const title = String(body?.title || "").trim();
  const payType = String(body?.payType || "HOURLY") === "PER_JOB" ? "PER_JOB" : "HOURLY";

  if (!name || !username) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== id) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id },
    data: { name, username, title: title || null, payType },
  });

  return NextResponse.json({ ok: true });
}
