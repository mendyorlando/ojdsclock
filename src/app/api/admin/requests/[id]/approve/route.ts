import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyHourEntry } from "@/lib/manualHours";

/** Mirrors src/app/admin/requests/actions.ts's approveRequest server action. */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;

  const claimed = await prisma.correctionRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "APPROVED", resolvedAt: new Date() },
  });

  if (claimed.count > 0) {
    const request = await prisma.correctionRequest.findUnique({ where: { id } });
    if (request) {
      await applyHourEntry(request.userId, request.requestedStart, request.requestedEnd, "manual-entry");
    }
  }

  return NextResponse.json({ ok: true });
}
