import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCsvLine } from "@/lib/csv";

function parsePayType(raw: string | undefined): "HOURLY" | "PER_JOB" {
  const norm = (raw || "").toLowerCase().replace(/[\s_-]/g, "");
  if (norm.includes("job") || norm.includes("salary") || norm.includes("perjob")) return "PER_JOB";
  return "HOURLY";
}

/**
 * JSON equivalent of src/app/admin/upload/route.ts (the website's
 * multipart CSV form) - same parsing/upsert logic, takes the CSV as a
 * plain string in the body instead of a file upload, since the mobile
 * app reads the file itself via expo-document-picker.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const text = String(body?.csv || "");
  if (!text) return NextResponse.json({ error: "invalid" }, { status: 400 });

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
        },
      });
      created += 1;
    }
  }

  return NextResponse.json({ created, updated, skipped });
}
