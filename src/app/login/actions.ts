"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";

function safeNext(next: string) {
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safeNext(String(formData.get("next") || "/dashboard"));

  if (!username || !password) {
    redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !ok) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  await createSession(user.id);
  redirect(next);
}
