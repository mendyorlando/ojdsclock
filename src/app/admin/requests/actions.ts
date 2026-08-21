"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { applyHourEntry } from "@/lib/manualHours";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");
  return user;
}

export async function approveRequest(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("requestId") || "");

  const request = await prisma.correctionRequest.findUnique({ where: { id } });
  if (request && request.status === "PENDING") {
    await applyHourEntry(request.userId, request.requestedStart, request.requestedEnd, "manual-entry");
    await prisma.correctionRequest.update({
      where: { id },
      data: { status: "APPROVED", resolvedAt: new Date() },
    });
  }

  revalidatePath("/admin/requests");
  revalidatePath(`/admin/teacher/${request?.userId}`);
}

export async function denyRequest(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("requestId") || "");

  const request = await prisma.correctionRequest.findUnique({ where: { id } });
  if (request && request.status === "PENDING") {
    await prisma.correctionRequest.update({
      where: { id },
      data: { status: "DENIED", resolvedAt: new Date() },
    });
  }

  revalidatePath("/admin/requests");
  if (request) revalidatePath(`/admin/teacher/${request.userId}`);
}
