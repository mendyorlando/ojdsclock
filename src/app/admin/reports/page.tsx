import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeRangeStats, startOfMonth } from "@/lib/hours";
import { Nav } from "@/components/Nav";

function toInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/reports");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();

  const defaultFrom = startOfMonth(now);
  const defaultTo = now;

  const from = parseDateParam(params.from, defaultFrom);
  const toRaw = parseDateParam(params.to, defaultTo);
  const to = new Date(toRaw);
  to.setDate(to.getDate() + 1); // make the "to" date inclusive

  const teachers = await prisma.user.findMany({ where: { role: "TEACHER" }, orderBy: { name: "asc" } });

  const rows = await Promise.all(
    teachers.map(async (t) => {
      const stats = await computeRangeStats(t.id, from, to, now);
      return { user: t, ...stats };
    }),
  );

  const totalHours = Math.round(rows.reduce((sum, r) => sum + r.hours, 0) * 10) / 10;

  const exportHref = `/admin/reports/export?from=${toInputValue(from)}&to=${toInputValue(toRaw)}`;

  return (
    <div className="stage-light flex-1 flex flex-col">
      <Nav name={user.name} title={user.title} isAdmin={true} active="reports" />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Hours by date range</h1>
          <p className="text-ink-soft text-sm mt-1">
            {totalHours} total hours across {rows.length} teacher{rows.length === 1 ? "" : "s"}
          </p>
        </div>

        <form className="glass-card rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
              From
            </label>
            <input
              type="date"
              name="from"
              defaultValue={toInputValue(from)}
              className="field rounded-xl px-3 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
              To
            </label>
            <input
              type="date"
              name="to"
              defaultValue={toInputValue(toRaw)}
              className="field rounded-xl px-3 py-2 text-sm font-semibold"
            />
          </div>
          <button type="submit" className="btn-teal-gradient rounded-xl px-5 py-2.5 text-sm font-bold text-white">
            View
          </button>
          <a
            href={exportHref}
            className="btn-gradient rounded-xl px-5 py-2.5 text-sm font-bold text-white inline-flex items-center"
          >
            Export CSV
          </a>
        </form>

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
                    Days worked
                  </th>
                  <th className="text-left font-extrabold text-ink-soft text-xs uppercase tracking-wider px-4 py-3">
                    Total hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.user.id} className={i % 2 === 1 ? "bg-teal-100/20" : ""}>
                    <td className="px-4 py-3 font-bold text-ink">
                      <Link href={`/admin/teacher/${r.user.id}`} className="hover:underline">
                        {r.user.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink-soft">
                      {r.user.payType === "HOURLY" ? "Hourly" : "Job"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink tabular-nums">{r.daysWorked}</td>
                    <td className="px-4 py-3 font-extrabold text-ink tabular-nums">{r.hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
