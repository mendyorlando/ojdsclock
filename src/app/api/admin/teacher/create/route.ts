import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parsePayType(raw: string | undefined): "HOURLY" | "PER_JOB" {
  const norm = (raw || "").toLowerCase().replace(/[\s_-]/g, "");
  if (norm.includes("job") || norm.includes("salary") || norm.includes("perjob")) return "PER_JOB";
  return "HOURLY";
}

/** Adds a single teacher from the app, same validation as the CSV roster upload. */
export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (admin.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const username = String(body?.username || "").trim().toLowerCase();
  const password = String(body?.password || "").trim();
  const title = String(body?.title || "").trim();
  const payType = parsePayType(body?.payType);

  if (!name || !username || !password) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  const created = await prisma.user.create({
    data: {
      username,
      name,
      payType,
      title: title || null,
      role: "TEACHER",
      passwordHash: await hashPassword(password),
      schoolId: admin.schoolId,
    },
  });

  return NextResponse.json({ id: created.id });
}
