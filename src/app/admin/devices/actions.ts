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

export async function approveDevice(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("requestId") || "");

  const request = await prisma.deviceRequest.findUnique({ where: { id } });
  if (request && request.status === "PENDING") {
    await prisma.user.update({
      where: { id: request.userId },
      data: { boundDeviceId: request.deviceId },
    });
    await prisma.deviceRequest.update({
      where: { id },
      data: { status: "APPROVED", resolvedAt: new Date() },
    });
    // Any other pending requests for this teacher were for a device that
    // just got superseded, so they no longer make sense to approve.
    await prisma.deviceRequest.updateMany({
      where: { userId: request.userId, status: "PENDING" },
      data: { status: "DENIED", resolvedAt: new Date() },
    });
  }

  revalidatePath("/admin/devices");
  if (request) revalidatePath(`/admin/teacher/${request.userId}`);
}

export async function denyDevice(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("requestId") || "");

  const request = await prisma.deviceRequest.findUnique({ where: { id } });
  if (request && request.status === "PENDING") {
    await prisma.deviceRequest.update({
      where: { id },
      data: { status: "DENIED", resolvedAt: new Date() },
    });
  }

  revalidatePath("/admin/devices");
  if (request) revalidatePath(`/admin/teacher/${request.userId}`);
}

export async function unbindDevice(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { boundDeviceId: null } });
  }
  revalidatePath(`/admin/teacher/${userId}`);
  revalidatePath("/admin/devices");
}
