import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * "Removing" an employee deactivates rather than deletes them - keeps every
 * clock event and past request on record for payroll/audit purposes, just
 * blocks sign-in and hides them from the active roster. Reversible via the
 * sibling reactivate route.
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "TEACHER") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { active: false } });
  // Same reasoning as unbind-device: cut off whatever phone is currently
  // signed in, not just block the next login attempt.
  await prisma.session.deleteMany({ where: { userId: id } });

  return NextResponse.json({ ok: true });
}
