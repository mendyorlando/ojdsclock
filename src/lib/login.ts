import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { formatDeviceLabel } from "@/lib/device";
import type { User } from "@prisma/client";

export type LoginResult = { ok: true; user: User } | { ok: false; reason: "invalid" | "device_pending" };

/**
 * Verifies credentials and, for teacher accounts, enforces the
 * single-bound-device rule: shared by the web login form and the mobile
 * app's JSON login endpoint so the two never drift apart.
 */
export async function attemptLogin(
  username: string,
  password: string,
  deviceId: string,
  userAgent: string,
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { username } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !ok) return { ok: false, reason: "invalid" };

  // Admin isn't an employee tapping a door tag, so it can sign in from
  // anywhere. Teacher accounts are locked to whichever device they first
  // sign in from, so someone can't log out and log into a coworker's
  // account on their own phone to tap for them.
  if (user.role === "TEACHER") {
    let boundDeviceId = user.boundDeviceId;

    if (!boundDeviceId) {
      // Atomic: only the login that actually flips null -> deviceId wins
      // the first-ever binding, so two logins landing at nearly the same
      // instant from different devices can't both slip through.
      const claimed = await prisma.user.updateMany({
        where: { id: user.id, boundDeviceId: null },
        data: { boundDeviceId: deviceId },
      });
      boundDeviceId =
        claimed.count > 0
          ? deviceId
          : ((await prisma.user.findUnique({ where: { id: user.id } }))?.boundDeviceId ?? null);
    }

    if (boundDeviceId !== deviceId) {
      const alreadyPending = await prisma.deviceRequest.findFirst({
        where: { userId: user.id, deviceId, status: "PENDING" },
      });
      if (!alreadyPending) {
        await prisma.deviceRequest.create({
          data: { userId: user.id, deviceId, deviceLabel: formatDeviceLabel(userAgent) },
        });
      }
      return { ok: false, reason: "device_pending" };
    }
  }

  return { ok: true, user };
}
