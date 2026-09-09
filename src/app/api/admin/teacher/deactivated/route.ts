import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Separate from /api/admin/overview (which only ever returns active staff, the common path) - this is admin/rare-use data for the "Deactivated staff" section. */
export async function GET() {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const rows = await prisma.user.findMany({
    where: { role: "TEACHER", active: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, title: true },
  });

  return NextResponse.json({ rows });
}
