import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { parseCsvLine } from "@/lib/csv";

function parsePayType(raw: string | undefined): "HOURLY" | "PER_JOB" {
  const norm = (raw || "").toLowerCase().replace(/[\s_-]/g, "");
  if (norm.includes("job") || norm.includes("salary") || norm.includes("perjob")) return "PER_JOB";
  return "HOURLY";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    const url = new URL("/admin", req.url);
    url.searchParams.set("csvError", "Choose a CSV file first.");
    return NextResponse.redirect(url, { status: 303 });
  }

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const line of lines) {
    const [rawName, rawUsername, rawPassword, rawPayType, rawTitle] = parseCsvLine(line);
    if (!rawUsername) continue;
    const username = rawUsername.trim().toLowerCase();
    if (username === "username") continue; // header row

    const name = (rawName || "").trim();
    const password = (rawPassword || "").trim();
    const payType = parsePayType(rawPayType);
    const title = (rawTitle || "").trim();

    const existing = await prisma.user.findUnique({ where: { username } });

    if (existing) {
      if (existing.role !== "TEACHER") {
        skipped += 1;
        continue;
      }
      await prisma.user.update({
        where: { username },
        data: {
          name: name || existing.name,
          payType,
          active: true,
          ...(title ? { title } : {}),
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
      });
      updated += 1;
    } else {
      if (!name || !password) {
        skipped += 1;
        continue;
      }
      await prisma.user.create({
        data: {
          username,
          name,
          payType,
          title: title || null,
          role: "TEACHER",
          passwordHash: await hashPassword(password),
          schoolId: user.schoolId,
        },
      });
      created += 1;
    }
  }

  const url = new URL("/admin", req.url);
  url.searchParams.set("csvCreated", String(created));
  url.searchParams.set("csvUpdated", String(updated));
  if (skipped > 0) url.searchParams.set("csvSkipped", String(skipped));
  return NextResponse.redirect(url, { status: 303 });
}
