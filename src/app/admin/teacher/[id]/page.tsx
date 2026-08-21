import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeYearStats, computeStreak, startOfMonth } from "@/lib/hours";
import { tagLabel } from "@/lib/tags";
import { Nav } from "@/components/Nav";
import { FlameIcon } from "@/components/icons";
import { updateTeacherInfo, addHoursAction, generateDemoDataAction } from "./actions";
import { approveRequest, denyRequest } from "@/app/admin/requests/actions";
import { unbindDevice } from "@/app/admin/devices/actions";

function toInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function TeacherDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; error?: string }>;
}) {
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");
  if (admin.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const teacher = await prisma.user.findUnique({ where: { id } });
  if (!teacher || teacher.role !== "TEACHER") notFound();

  const query = await searchParams;
  const now = new Date();
  const from = parseDateParam(query.from, startOfMonth(now));
  const toRaw = parseDateParam(query.to, now);
  const to = new Date(toRaw);
  to.setDate(to.getDate() + 1);

  const [year, streak, events, pendingRequests] = await Promise.all([
    computeYearStats(teacher.id, now),
    computeStreak(teacher.id, now),
    prisma.clockEvent.findMany({
      where: { userId: teacher.id, timestamp: { gte: from, lt: to } },
      orderBy: { timestamp: "desc" },
    }),
    prisma.correctionRequest.findMany({
      where: { userId: teacher.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="stage-light flex-1 flex flex-col">
      <Nav name={admin.name} title={admin.title} isAdmin={true} active="admin" />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 flex-1 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">{teacher.name}</h1>
          <p className="text-ink-soft text-sm mt-1">{teacher.title || "Staff"}</p>
        </div>

        {query.error && (
          <div className="rounded-2xl bg-crit-bg text-crit text-sm font-bold px-4 py-3">{query.error}</div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-4">
            <div className="text-xl font-extrabold text-ink">{year.hoursThisWeek}</div>
            <p className="text-xs font-bold text-ink-soft mt-0.5">Hours this week</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="text-xl font-extrabold text-ink">{year.hoursThisMonth}</div>
            <p className="text-xs font-bold text-ink-soft mt-0.5">Hours this month</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="text-xl font-extrabold text-ink">
              {year.hoursThisYear}h &middot; {year.daysThisYear}d
            </div>
            <p className="text-xs font-bold text-ink-soft mt-0.5">This year</p>
          </div>
          <div className="glass-card rounded-2xl p-4 flex items-center gap-2">
            <FlameIcon className="h-5 w-5 text-orange-600" />
            <div>
              <div className="text-xl font-extrabold text-ink">{streak}</div>
              <p className="text-xs font-bold text-ink-soft -mt-0.5">day streak</p>
            </div>
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-ink-soft uppercase tracking-wider">
              Pending requests from {teacher.name.split(" ")[0]}
            </h2>
            {pendingRequests.map((r) => (
              <div key={r.id} className="glass-card rounded-2xl p-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-ink">
                    {r.requestedStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    {", "}
                    {r.requestedStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} to{" "}
                    {r.requestedEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <p className="text-sm text-ink-soft font-semibold mt-1">&ldquo;{r.reason}&rdquo;</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={approveRequest}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <button type="submit" className="btn-teal-gradient rounded-xl px-4 py-2 text-xs font-bold text-white cursor-pointer">
                      Approve
                    </button>
                  </form>
                  <form action={denyRequest}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <button type="submit" className="rounded-xl px-4 py-2 text-xs font-bold text-crit bg-crit-bg cursor-pointer">
                      Deny
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start">
          <div className="glass-card rounded-[1.75rem] overflow-hidden">
            <div className="p-5 pb-0 flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-extrabold text-ink text-sm">Clock history</h2>
              <form className="flex items-end gap-2">
                <input type="date" name="from" defaultValue={toInputValue(from)} className="field rounded-lg px-2.5 py-1.5 text-xs font-semibold" />
                <input type="date" name="to" defaultValue={toInputValue(toRaw)} className="field rounded-lg px-2.5 py-1.5 text-xs font-semibold" />
                <button type="submit" className="btn-teal-gradient rounded-lg px-3 py-1.5 text-xs font-bold text-white">
                  Filter
                </button>
              </form>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-teal-100/50">
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">Date</th>
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">Time</th>
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">Type</th>
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">Where</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm font-semibold text-ink-soft">
                        No clock events in this range.
                      </td>
                    </tr>
                  )}
                  {events.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 1 ? "bg-teal-100/20" : ""}>
                      <td className="px-4 py-3 font-semibold text-ink">
                        {e.timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink tabular-nums">
                        {e.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full text-xs font-extrabold px-3 py-1 ${
                            e.type === "IN" ? "bg-good-bg text-good" : "bg-teal-100/60 text-ink-soft"
                          }`}
                        >
                          {e.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink-soft">{tagLabel(e.tagId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <div className="glass-card rounded-[1.5rem] p-5">
              <h2 className="font-extrabold text-ink text-sm mb-3">Teacher info</h2>
              <form action={updateTeacherInfo} className="space-y-3">
                <input type="hidden" name="userId" value={teacher.id} />
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">Name</label>
                  <input name="name" defaultValue={teacher.name} className="field w-full rounded-lg px-3 py-2 text-sm font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">Username</label>
                  <input
                    name="username"
                    defaultValue={teacher.username}
                    autoCapitalize="off"
                    className="field w-full rounded-lg px-3 py-2 text-sm font-semibold"
                  />
                  <p className="text-[11px] font-semibold text-ink-faint mt-1">
                    Set this to &ldquo;test&rdquo; to designate this account for demo data.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">Title</label>
                  <input
                    name="title"
                    defaultValue={teacher.title || ""}
                    placeholder="e.g. Kindergarten Teacher"
                    className="field w-full rounded-lg px-3 py-2 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">Pay type</label>
                  <select
                    name="payType"
                    defaultValue={teacher.payType}
                    className="field w-full rounded-lg px-3 py-2 text-sm font-semibold"
                  >
                    <option value="HOURLY">Hourly</option>
                    <option value="PER_JOB">Job</option>
                  </select>
                </div>
                <button type="submit" className="btn-teal-gradient w-full rounded-xl py-2.5 text-sm font-bold text-white cursor-pointer">
                  Save
                </button>
              </form>
            </div>

            <div className="glass-card rounded-[1.5rem] p-5">
              <h2 className="font-extrabold text-ink text-sm mb-1">Add hours</h2>
              <p className="text-xs font-semibold text-ink-soft mb-3">
                Only adds time not already on record for that window.
              </p>
              <form action={addHoursAction} className="space-y-3">
                <input type="hidden" name="userId" value={teacher.id} />
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">Date</label>
                  <input type="date" name="date" required className="field w-full rounded-lg px-3 py-2 text-sm font-semibold" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">From</label>
                    <input type="time" name="startTime" required className="field w-full rounded-lg px-3 py-2 text-sm font-semibold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">To</label>
                    <input type="time" name="endTime" required className="field w-full rounded-lg px-3 py-2 text-sm font-semibold" />
                  </div>
                </div>
                <button type="submit" className="btn-gradient w-full rounded-xl py-2.5 text-sm font-bold text-white cursor-pointer">
                  Add hours
                </button>
              </form>
            </div>

            <div className="glass-card rounded-[1.5rem] p-5">
              <h2 className="font-extrabold text-ink text-sm mb-1">Device lock</h2>
              <p className="text-xs font-semibold text-ink-soft mb-3">
                {teacher.boundDeviceId
                  ? "Locked to the phone this account first signed in on. Signing in from any other phone gets flagged on the Devices page instead of letting them in."
                  : "Not bound yet. The next phone this account signs in from becomes its locked device."}
              </p>
              {teacher.boundDeviceId && (
                <form action={unbindDevice}>
                  <input type="hidden" name="userId" value={teacher.id} />
                  <button
                    type="submit"
                    className="w-full rounded-xl py-2.5 text-sm font-bold text-crit bg-crit-bg cursor-pointer"
                  >
                    Unbind device
                  </button>
                </form>
              )}
            </div>

            {teacher.username === "test" && (
              <div className="glass-card rounded-[1.5rem] p-5">
                <h2 className="font-extrabold text-ink text-sm mb-1">Test employee tools</h2>
                <p className="text-xs font-semibold text-ink-soft mb-3">
                  Wipes this account&apos;s clock history and requests, and replaces them with
                  about four months of realistic fake data (streaks, gaps, sample requests
                  included).
                </p>
                <form action={generateDemoDataAction}>
                  <input type="hidden" name="userId" value={teacher.id} />
                  <button
                    type="submit"
                    className="w-full rounded-xl py-2.5 text-sm font-bold text-crit bg-crit-bg cursor-pointer"
                  >
                    Generate demo data
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
