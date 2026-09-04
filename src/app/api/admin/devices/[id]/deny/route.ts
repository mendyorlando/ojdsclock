import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Mirrors src/app/admin/devices/actions.ts's denyDevice server action. */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;

  await prisma.deviceRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "DENIED", resolvedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
