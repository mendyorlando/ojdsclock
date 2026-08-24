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

  // Atomic: only the caller that actually flips PENDING -> APPROVED goes on
  // to rebind the device, so a double-click or a concurrent deny can't both
  // "win" against the same request.
  const claimed = await prisma.deviceRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "APPROVED", resolvedAt: new Date() },
  });

  if (claimed.count > 0) {
    const request = await prisma.deviceRequest.findUnique({ where: { id } });
    if (request) {
      await prisma.user.update({
        where: { id: request.userId },
        data: { boundDeviceId: request.deviceId },
      });
      // Whichever device was previously signed in no longer matches the
      // account's new lock, so its session is ended too, not just its
      // ability to log back in. Otherwise an old phone stays signed in
      // indefinitely even after a new one is approved.
      await prisma.session.deleteMany({ where: { userId: request.userId } });
      // Any other pending requests for this teacher were for a device that
      // just got superseded, so they no longer make sense to approve.
      await prisma.deviceRequest.updateMany({
        where: { userId: request.userId, status: "PENDING" },
        data: { status: "DENIED", resolvedAt: new Date() },
      });
      revalidatePath(`/admin/teacher/${request.userId}`);
    }
  }

  revalidatePath("/admin/devices");
}

export async function denyDevice(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("requestId") || "");

  const request = await prisma.deviceRequest.findFirst({ where: { id, status: "PENDING" } });
  await prisma.deviceRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "DENIED", resolvedAt: new Date() },
  });

  revalidatePath("/admin/devices");
  if (request) revalidatePath(`/admin/teacher/${request.userId}`);
}

export async function unbindDevice(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { boundDeviceId: null } });
    // Clearing the lock is meant to cut off whatever phone is currently
    // signed in (lost/stolen phone, etc.), not just allow a new one to bind
    // next time, so end its session here too.
    await prisma.session.deleteMany({ where: { userId } });
  }
  revalidatePath(`/admin/teacher/${userId}`);
  revalidatePath("/admin/devices");
}
