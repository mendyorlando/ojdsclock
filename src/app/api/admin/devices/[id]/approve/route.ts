import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Mirrors src/app/admin/devices/actions.ts's approveDevice server action. */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;

  // Atomic: only the caller that actually flips PENDING -> APPROVED goes on
  // to rebind the device, so a double-tap or a concurrent deny can't both
  // "win" against the same request.
  const claimed = await prisma.deviceRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "APPROVED", resolvedAt: new Date() },
  });

  if (claimed.count > 0) {
    const request = await prisma.deviceRequest.findUnique({ where: { id } });
    if (request) {
      await prisma.user.update({
        where: { id: request.userId },
        data: { boundDeviceId: request.deviceId },
      });
      await prisma.session.deleteMany({ where: { userId: request.userId } });
      await prisma.deviceRequest.updateMany({
        where: { userId: request.userId, status: "PENDING" },
        data: { status: "DENIED", resolvedAt: new Date() },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
