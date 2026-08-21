import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { computeAdminOverview } from "@/lib/hours";
import { Nav } from "@/components/Nav";
import { UploadIcon } from "@/components/icons";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ csvUpdated?: string; csvCreated?: string; csvError?: string; csvSkipped?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const overview = await computeAdminOverview();

  return (
    <div className="stage-light flex-1 flex flex-col">
      <Nav name={user.name} title={user.title} isAdmin={true} active="admin" />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">Staff overview</h1>
            <p className="text-ink-soft text-sm mt-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="btn-teal-gradient rounded-xl px-4 py-2.5 text-sm font-bold text-white"
          >
            View custom date range
          </Link>
        </div>

        {(params.csvUpdated !== undefined || params.csvCreated !== undefined) && (
          <div className="rounded-2xl bg-good-bg text-good text-sm font-bold px-4 py-3 mb-5">
            {params.csvCreated && params.csvCreated !== "0" && `Created ${params.csvCreated} new teacher${params.csvCreated === "1" ? "" : "s"}. `}
            {params.csvUpdated && params.csvUpdated !== "0" && `Updated ${params.csvUpdated} teacher${params.csvUpdated === "1" ? "" : "s"}. `}
            {params.csvSkipped && (
              <span className="block font-semibold mt-1">Skipped rows: {params.csvSkipped}</span>
            )}
          </div>
        )}
        {params.csvError && (
          <div className="rounded-2xl bg-crit-bg text-crit text-sm font-bold px-4 py-3 mb-5">
            {params.csvError}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
          <div className="glass-card tilt rounded-2xl p-4">
            <div className="text-2xl font-extrabold text-ink">{overview.totalStaff}</div>
            <p className="text-xs font-bold text-ink-soft mt-0.5">Total staff</p>
          </div>
          <div className="glass-card tilt rounded-2xl p-4">
            <div className="text-2xl font-extrabold text-good">{overview.clockedInNow}</div>
            <p className="text-xs font-bold text-ink-soft mt-0.5">Clocked in now</p>
          </div>
          <div className="glass-card tilt rounded-2xl p-4">
            <div className="text-2xl font-extrabold text-ink">{overview.totalHoursThisWeek}</div>
            <p className="text-xs font-bold text-ink-soft mt-0.5">Hours this week</p>
          </div>
          <div className="glass-card tilt rounded-2xl p-4">
            <div className="text-2xl font-extrabold text-ink">{overview.totalHoursThisMonth}</div>
            <p className="text-xs font-bold text-ink-soft mt-0.5">Hours this month</p>
          </div>
          <div className="glass-card tilt rounded-2xl p-4">
            <div className="text-2xl font-extrabold text-ink">{overview.avgHoursThisMonth}</div>
            <p className="text-xs font-bold text-ink-soft mt-0.5">Avg hrs / teacher</p>
          </div>
          <div className="glass-card tilt rounded-2xl p-4">
            <div className="text-2xl font-extrabold text-orange-600">{overview.topStreak}</div>
            <p className="text-xs font-bold text-ink-soft mt-0.5">Best streak</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start">
          <div className="glass-card rounded-[1.75rem] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-teal-100/50">
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">
                      Employee
                    </th>
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">
                      Pay type
                    </th>
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">
                      This week
                    </th>
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">
                      This month
                    </th>
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">
                      This year
                    </th>
                    <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.rows.map((r, i) => (
                    <tr key={r.user.id} className={i % 2 === 1 ? "bg-teal-100/20" : ""}>
                      <td className="px-4 py-3 font-bold text-ink">
                        <Link href={`/admin/teacher/${r.user.id}`} className="hover:underline">
                          {r.user.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink-soft">
                        {r.user.payType === "HOURLY" ? "Hourly" : "Job"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink tabular-nums">{r.hoursThisWeek}h</td>
                      <td className="px-4 py-3 font-semibold text-ink tabular-nums">{r.hoursThisMonth}h</td>
                      <td className="px-4 py-3 font-semibold text-ink tabular-nums">
                        {r.hoursThisYear}h &middot; {r.daysThisYear}d
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full text-xs font-extrabold px-3 py-1 ${
                            r.currentlyIn ? "bg-good-bg text-good" : "bg-teal-100/60 text-ink-soft"
                          }`}
                        >
                          {r.currentlyIn ? "Clocked in" : "Clocked out"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <div className="glass-card rounded-[1.5rem] p-5">
              <h2 className="font-extrabold text-ink text-sm mb-1">Import teacher roster</h2>
              <p className="text-xs font-semibold text-ink-soft mb-3">
                A CSV with columns: name, username, password, payType (Hourly or Job), and an
                optional title (e.g. &ldquo;Kindergarten Teacher&rdquo;). Existing usernames are
                updated, new ones are created.
              </p>
              <form action="/admin/upload" method="post" encType="multipart/form-data" className="space-y-3">
                <label className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-100/30 px-4 py-6 text-center cursor-pointer">
                  <UploadIcon className="h-6 w-6 text-teal-600" />
                  <span className="text-xs font-bold text-ink-soft">Choose a CSV file</span>
                  <input type="file" name="file" accept=".csv,text/csv" className="hidden" />
                </label>
                <button
                  type="submit"
                  className="btn-gradient w-full rounded-xl py-2.5 text-sm font-bold text-white cursor-pointer"
                >
                  Upload
                </button>
              </form>
            </div>

            <div className="glass-card rounded-[1.5rem] p-5">
              <h2 className="font-extrabold text-ink text-sm mb-1">Long-shift reminders</h2>
              <p className="text-xs font-semibold text-ink-soft mb-3">
                Runs automatically once a day (past 5:00 PM Eastern). This button is here so you
                can trigger it on demand instead of waiting.
              </p>
              <a
                href="/api/cron/long-shift-check"
                className="btn-teal-gradient inline-flex w-full justify-center rounded-xl py-2.5 text-sm font-bold text-white"
              >
                Run check now
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
