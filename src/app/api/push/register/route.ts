import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Registers (or re-associates) an Expo push token for the signed-in user. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "");
  if (!token) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // A token is unique per install, but the same phone could get
  // reassigned to a different user (device sold, re-provisioned, etc.) -
  // upsert-by-token keeps the token's owner current instead of erroring.
  await prisma.expoPushToken.upsert({
    where: { token },
    update: { userId: user.id },
    create: { userId: user.id, token },
  });

  return NextResponse.json({ ok: true });
}
