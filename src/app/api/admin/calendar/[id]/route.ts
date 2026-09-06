import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;
  await prisma.schoolClosure.delete({ where: { id } }).catch(() => {});

  return NextResponse.json({ ok: true });
}
