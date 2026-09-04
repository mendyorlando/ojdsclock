import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const [pending, resolved] = await Promise.all([
    prisma.correctionRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.correctionRequest.findMany({
      where: { status: { not: "PENDING" } },
      include: { user: true },
      orderBy: { resolvedAt: "desc" },
      take: 15,
    }),
  ]);

  return NextResponse.json({
    pending: pending.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      requestedStart: r.requestedStart.toISOString(),
      requestedEnd: r.requestedEnd.toISOString(),
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    })),
    resolved: resolved.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      requestedStart: r.requestedStart.toISOString(),
      requestedEnd: r.requestedEnd.toISOString(),
      reason: r.reason,
      status: r.status,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    })),
  });
}
