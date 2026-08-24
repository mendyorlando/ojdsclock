import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeWeekDays, computeStreak, computeYearStats } from "@/lib/hours";
import { tagLabel } from "@/lib/tags";
import { Nav } from "@/components/Nav";
import { FlameIcon, ChevronDownIcon } from "@/components/icons";
import { NotificationOptIn } from "@/components/NotificationOptIn";

const HISTORY_LIMIT = 500;

function formatTime(d: Date | null) {
  if (!d) return null;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "ADMIN") redirect("/admin");

  const now = new Date();
  const [days, streak, year, history] = await Promise.all([
    computeWeekDays(user.id, now),
    computeStreak(user.id, now),
    computeYearStats(user.id, now),
    prisma.clockEvent.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: "desc" },
      take: HISTORY_LIMIT + 1,
    }),
  ]);

  const currentlyIn = days.some((d) => d.inProgress);
  const historyTruncated = history.length > HISTORY_LIMIT;
  const historyEvents = history.slice(0, HISTORY_LIMIT);

  return (
    <div className="stage-light flex-1 flex flex-col">
      <Nav name={user.name} title={user.title} isAdmin={false} active="dashboard" />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 flex-1">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">
              {user.name.split(" ")[0]}&apos;s hours
            </h1>
            <p className="text-ink-soft text-sm mt-1">{user.title || "Staff"}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full text-xs font-extrabold px-3.5 py-1.5 ${
                currentlyIn ? "bg-good-bg text-good" : "bg-teal-100/60 text-ink-soft"
              }`}
            >
              {currentlyIn ? "Currently clocked in" : "Not clocked in right now"}
            </span>
            <Link
              href="/dashboard/request"
              className="rounded-full text-xs font-extrabold px-3.5 py-1.5 bg-orange-100 text-orange-700"
            >
              Request a correction
            </Link>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div
              className="tilt rounded-[1.75rem] p-6 text-white relative overflow-hidden"
              style={{
                background: "linear-gradient(155deg, var(--color-teal-500), var(--color-teal-900))",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.2), 0 30px 50px -20px rgba(11,59,56,.5), 0 10px 24px -10px rgba(255,122,51,.18)",
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">This month</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-extrabold">{year.hoursThisMonth}</span>
                <span className="text-lg font-bold opacity-70">hours</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-5">
                <div>
                  <p className="text-xl font-extrabold">{year.hoursThisWeek}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-70 mt-0.5">This week</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold">{year.hoursThisYear}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-70 mt-0.5">This year</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold">{year.daysThisYear}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-70 mt-0.5">Days this year</p>
                </div>
              </div>
            </div>

            <div className="glass-card tilt rounded-2xl p-4 flex items-center gap-3">
              <FlameIcon className="h-6 w-6 text-orange-600 shrink-0" />
              <div>
                <p className="text-lg font-extrabold text-ink leading-tight">{streak}-day streak</p>
                <p className="text-xs font-bold text-ink-soft">consecutive school days clocked in</p>
              </div>
            </div>

            <NotificationOptIn />
          </div>

          <div className="glass-card rounded-[1.75rem] p-5">
            <p className="text-sm font-extrabold text-ink mb-3">This week</p>
            <div className="space-y-2">
              {days.map((day) => (
                <div
                  key={day.label}
                  className={`rounded-xl px-3 py-2.5 ${day.isToday ? "bg-orange-100/60" : "bg-white"}`}
                  style={{ boxShadow: "0 6px 14px -10px rgba(11,59,56,.2)" }}
                >
                  <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3">
                    <span
                      className={`text-xs font-extrabold text-center ${
                        day.isToday ? "text-orange-700" : "text-ink-soft"
                      }`}
                    >
                      {day.label}
                    </span>
                    <span className="text-xs font-bold text-ink-soft">
                      {day.isFuture
                        ? "Not yet"
                        : day.sessions.length > 0
                          ? day.sessions
                              .map(
                                (s) =>
                                  `${tagLabel(s.tagId)}: ${formatTime(s.start)} to ${
                                    s.end ? formatTime(s.end) : "now"
                                  }`,
                              )
                              .join(", ")
                          : "Not yet"}
                    </span>
                    <span className="text-sm font-extrabold text-ink text-right">
                      {day.hours > 0 ? `${day.hours}h` : "-"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-[1.75rem] overflow-hidden md:col-span-2">
            <input type="checkbox" id="all-history-toggle" className="peer hidden" />
            <label
              htmlFor="all-history-toggle"
              className="flex items-center justify-between px-5 py-4 cursor-pointer"
            >
              <span className="text-sm font-extrabold text-ink">All History</span>
              <ChevronDownIcon className="h-4 w-4 text-ink-soft shrink-0" />
            </label>
            <div className="hidden peer-checked:block">
              {historyTruncated && (
                <p className="px-5 pb-2 text-xs font-semibold text-ink-faint">
                  Showing your most recent {HISTORY_LIMIT} entries.
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-teal-100/50">
                      <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-5 py-3">
                        Date
                      </th>
                      <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-5 py-3">
                        Time
                      </th>
                      <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-5 py-3">
                        Type
                      </th>
                      <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-5 py-3">
                        Where
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyEvents.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-sm font-semibold text-ink-soft">
                          No clock events yet.
                        </td>
                      </tr>
                    )}
                    {historyEvents.map((e, i) => (
                      <tr key={e.id} className={i % 2 === 1 ? "bg-teal-100/20" : ""}>
                        <td className="px-5 py-3 font-semibold text-ink">
                          {e.timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3 font-semibold text-ink tabular-nums">
                          {e.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full text-xs font-extrabold px-3 py-1 ${
                              e.type === "IN" ? "bg-good-bg text-good" : "bg-teal-100/60 text-ink-soft"
                            }`}
                          >
                            {e.type}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-ink-soft">{tagLabel(e.tagId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
