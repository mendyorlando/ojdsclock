"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession } from "@/lib/auth";
import { attemptLogin } from "@/lib/login";

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

  const userAgent = (await headers()).get("user-agent") || "";
  const result = await attemptLogin(username, password, deviceId, userAgent);

  if (!result.ok) {
    const error = result.reason === "device_pending" ? "device" : "invalid";
    redirect(`/login?error=${error}&next=${encodeURIComponent(next)}`);
  }

  await createSession(result.user.id);
  redirect(next);
}
