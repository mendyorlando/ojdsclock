"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { formatDeviceLabel } from "@/lib/device";

function safeNext(next: string) {
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const deviceId = String(formData.get("deviceId") || "").trim();
  const next = safeNext(String(formData.get("next") || "/dashboard"));

  if (!username || !password || !deviceId) {
    redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !ok) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  // Admin isn't an employee tapping a door tag, so it can sign in from
  // anywhere. Teacher accounts are locked to whichever device they first
  // sign in from, so someone can't log out and log into a coworker's
  // account on their own phone to tap for them.
  if (user.role === "TEACHER") {
    if (!user.boundDeviceId) {
      await prisma.user.update({ where: { id: user.id }, data: { boundDeviceId: deviceId } });
    } else if (user.boundDeviceId !== deviceId) {
      const alreadyPending = await prisma.deviceRequest.findFirst({
        where: { userId: user.id, deviceId, status: "PENDING" },
      });
      if (!alreadyPending) {
        const userAgent = (await headers()).get("user-agent") || "";
        await prisma.deviceRequest.create({
          data: { userId: user.id, deviceId, deviceLabel: formatDeviceLabel(userAgent) },
        });
      }
      redirect(`/login?error=device&next=${encodeURIComponent(next)}`);
    }
  }

  await createSession(user.id);
  redirect(next);
}
