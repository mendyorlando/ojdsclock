// Runs once when the server starts. In production, prefer a real scheduler
// (e.g. Vercel Cron hitting /api/cron/long-shift-check) instead of relying
// on this, since a serverless instance doesn't stay alive between requests.
// This interval is here so the reminder feature also works during local
// development without any extra setup.

const globalForInterval = globalThis as unknown as { __ojdsLongShiftInterval?: NodeJS.Timeout };

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalForInterval.__ojdsLongShiftInterval) return;

  const { checkLongShifts } = await import("@/lib/push");
  const FIVE_MINUTES = 5 * 60 * 1000;

  globalForInterval.__ojdsLongShiftInterval = setInterval(() => {
    checkLongShifts().catch((err) => {
      console.error("long-shift check failed", err);
    });
  }, FIVE_MINUTES);
}
