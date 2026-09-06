import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** JSON equivalent of src/app/admin/devices/actions.ts's unbindDevice. */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;

  await prisma.user.update({ where: { id }, data: { boundDeviceId: null } });
  // Clearing the lock is meant to cut off whatever phone is currently
  // signed in (lost/stolen phone, etc.), not just allow a new one to bind
  // next time, so end its session here too.
  await prisma.session.deleteMany({ where: { userId: id } });

  return NextResponse.json({ ok: true });
}
