import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** JSON equivalent of src/app/admin/devices/actions.ts's setDeviceLockExempt. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const exempt = Boolean(body?.exempt);

  await prisma.user.update({ where: { id }, data: { deviceLockExempt: exempt } });

  return NextResponse.json({ ok: true });
}
