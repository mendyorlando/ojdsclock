import { prisma } from "@/lib/prisma";

type PushPayload = { title: string; body: string; data?: Record<string, unknown>; badge?: number };

async function countPendingRequests() {
  const [devicePending, correctionPending] = await Promise.all([
    prisma.deviceRequest.count({ where: { status: "PENDING" } }),
    prisma.correctionRequest.count({ where: { status: "PENDING" } }),
  ]);
  return devicePending + correctionPending;
}

/**
 * Pushes to every admin's mobile device via Expo's push service - distinct
 * from src/lib/push.ts's web-push sender (that one's for the browser PWA's
 * long-shift reminder; this one's for the native app's Requests tab).
 */
async function sendToAdmins(payload: PushPayload) {
  const tokens = await prisma.expoPushToken.findMany({
    where: { user: { role: "ADMIN" } },
  });
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    badge: payload.badge,
  }));

  let tickets: Array<{ status: string; details?: { error?: string } }> = [];
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const json = await res.json();
    tickets = json?.data ?? [];
  } catch {
    return;
  }

  // A token whose app was uninstalled resolves with this specific error -
  // clean it up so we stop wasting sends on it. Any other error (rate
  // limiting, a transient service issue) is left alone.
  const staleTokens = tickets
    .map((ticket, i) => (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? tokens[i].token : null))
    .filter((t): t is string => t !== null);

  if (staleTokens.length > 0) {
    await prisma.expoPushToken.deleteMany({ where: { token: { in: staleTokens } } });
  }
}

export async function notifyAdminsOfDeviceRequest(userName: string, deviceLabel: string | null) {
  const badge = await countPendingRequests();
  await sendToAdmins({
    title: "Device sign-in request",
    body: `${userName} tried to sign in from ${deviceLabel || "an unrecognized device"}.`,
    data: { url: "/admin-requests" },
    badge,
  });
}

export async function notifyAdminsOfCorrectionRequest(userName: string) {
  const badge = await countPendingRequests();
  await sendToAdmins({
    title: "Hour correction request",
    body: `${userName} submitted an hour correction request.`,
    data: { url: "/admin-requests" },
    badge,
  });
}
