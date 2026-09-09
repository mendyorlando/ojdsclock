import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Undoes deactivate - the account can sign in and shows on the active roster again. */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "TEACHER") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { active: true } });

  return NextResponse.json({ ok: true });
}
