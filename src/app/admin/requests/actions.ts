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

  // Atomic: only the caller that actually flips PENDING -> APPROVED goes on
  // to apply the hours, so a double-click or a concurrent deny can't both
  // "win" against the same request.
  const claimed = await prisma.correctionRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "APPROVED", resolvedAt: new Date() },
  });

  if (claimed.count > 0) {
    const request = await prisma.correctionRequest.findUnique({ where: { id } });
    if (request) {
      await applyHourEntry(request.userId, request.requestedStart, request.requestedEnd, "manual-entry");
      revalidatePath(`/admin/teacher/${request.userId}`);
    }
  }

  revalidatePath("/admin/requests");
}

export async function denyRequest(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("requestId") || "");

  const request = await prisma.correctionRequest.findFirst({ where: { id, status: "PENDING" } });
  await prisma.correctionRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "DENIED", resolvedAt: new Date() },
  });

  revalidatePath("/admin/requests");
  if (request) revalidatePath(`/admin/teacher/${request.userId}`);
}
