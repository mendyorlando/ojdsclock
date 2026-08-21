"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { applyHourEntry } from "@/lib/manualHours";
import { generateDemoHistory } from "@/lib/demoData";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");
  return user;
}

export async function updateTeacherInfo(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const title = String(formData.get("title") || "").trim();
  const payType = String(formData.get("payType") || "HOURLY") === "PER_JOB" ? "PER_JOB" : "HOURLY";

  if (userId && name && username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== userId) {
      redirect(`/admin/teacher/${userId}?error=${encodeURIComponent("That username is already taken.")}`);
    }
    await prisma.user.update({
      where: { id: userId },
      data: { name, username, title: title || null, payType },
    });
  }

  revalidatePath(`/admin/teacher/${userId}`);
  revalidatePath("/admin");
}

export async function addHoursAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const date = String(formData.get("date") || "");
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");

  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);

  if (userId && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
    await applyHourEntry(userId, start, end, "manual-entry");
  }

  revalidatePath(`/admin/teacher/${userId}`);
  revalidatePath("/admin");
}

export async function generateDemoDataAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (userId) {
    // Server-side guard too, not just hiding the button: this only ever
    // touches the one account set aside for testing.
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (target && target.username === "test") {
      await generateDemoHistory(userId);
    }
  }

  revalidatePath(`/admin/teacher/${userId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
}
