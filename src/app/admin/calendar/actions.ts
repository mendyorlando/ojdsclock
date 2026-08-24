"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");
  return user;
}

export async function addClosure(formData: FormData) {
  await requireAdmin();
  const dateStr = String(formData.get("date") || "");
  const label = String(formData.get("label") || "").trim();

  const date = new Date(`${dateStr}T00:00:00`);
  if (!Number.isNaN(date.getTime())) {
    await prisma.schoolClosure.upsert({
      where: { date },
      update: { label: label || null },
      create: { date, label: label || null },
    });
  }

  revalidatePath("/admin/calendar");
}

export async function deleteClosure(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.schoolClosure.delete({ where: { id } }).catch(() => {});
  }
  revalidatePath("/admin/calendar");
}
