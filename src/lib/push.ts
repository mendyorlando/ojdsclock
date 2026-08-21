import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { isCurrentlyClockedIn } from "@/lib/hours";
import { tagLabel } from "@/lib/tags";

const CUTOFF_HOUR_ET = 17; // 5:00 PM America/New_York
const SCHOOL_TIME_ZONE = "America/New_York";

let configured = false;

function partsInSchoolZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12: false can render midnight as "24"; normalize to 0.
  const hour = Number(get("hour")) % 24;

  return { dateKey: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.org";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

async function sendToUser(userId: string, payload: Record<string, unknown>) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
      } catch {
        // Subscription is stale (expired, browser data cleared, etc). Drop it.
        await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      }
    }),
  );
}

export type LongShiftCheckResult = { checked: number; notified: number };

/**
 * Once it's past 5:00 PM Eastern, finds anyone still clocked in from
 * earlier (today before the cutoff, or any prior day) with no reminder
 * sent yet for that shift, and pushes a notification asking them to
 * confirm. This is time-based only, a website has no reliable way to know
 * whether someone actually left the building. Someone who clocks in after
 * 5:00 PM for an evening event is left alone that same evening; if they
 * forget to clock out, they'll be caught by this same check the next day.
 */
export async function checkLongShifts(now: Date = new Date()): Promise<LongShiftCheckResult> {
  if (!ensureConfigured()) return { checked: 0, notified: 0 };

  const nowParts = partsInSchoolZone(now);
  if (nowParts.hour < CUTOFF_HOUR_ET) return { checked: 0, notified: 0 };

  const teachers = await prisma.user.findMany({ where: { role: "TEACHER" } });
  let notified = 0;

  for (const teacher of teachers) {
    const stillIn = await isCurrentlyClockedIn(teacher.id);
    if (!stillIn) continue;

    const lastIn = await prisma.clockEvent.findFirst({
      where: { userId: teacher.id, type: "IN" },
      orderBy: { timestamp: "desc" },
    });
    if (!lastIn || lastIn.reminderSentAt) continue;

    const inParts = partsInSchoolZone(lastIn.timestamp);
    const clockedInBeforeCutoffToday = inParts.dateKey === nowParts.dateKey && inParts.hour < CUTOFF_HOUR_ET;
    const clockedInOnAnEarlierDay = inParts.dateKey !== nowParts.dateKey;
    if (!clockedInBeforeCutoffToday && !clockedInOnAnEarlierDay) continue;

    const hoursSince = Math.round(((now.getTime() - lastIn.timestamp.getTime()) / 3_600_000) * 10) / 10;

    await sendToUser(teacher.id, {
      title: "Still clocked in?",
      body: `You clocked in at ${tagLabel(lastIn.tagId)} ${hoursSince} hours ago and it's past 5:00 PM. Still at school?`,
      url: `/reminder/${lastIn.id}`,
    });

    await prisma.clockEvent.update({ where: { id: lastIn.id }, data: { reminderSentAt: now } });
    notified += 1;
  }

  return { checked: teachers.length, notified };
}
