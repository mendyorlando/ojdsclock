"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdminsOfCorrectionRequest } from "@/lib/expoPush";

export async function submitCorrectionRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const date = String(formData.get("date") || "");
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const reason = String(formData.get("reason") || "").trim();

  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start && reason) {
    await prisma.correctionRequest.create({
      data: { userId: user.id, requestedStart: start, requestedEnd: end, reason },
    });
    await notifyAdminsOfCorrectionRequest(user.name).catch(() => {});
  }

  redirect("/dashboard/request?submitted=1");
}
