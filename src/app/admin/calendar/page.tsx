import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "@/lib/hours";
import { Nav } from "@/components/Nav";
import { UploadIcon } from "@/components/icons";
import { addClosure, deleteClosure } from "./actions";

function formatClosureDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; skipped?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/calendar");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const today = startOfDay(new Date());

  const [upcoming, past] = await Promise.all([
    prisma.schoolClosure.findMany({ where: { date: { gte: today } }, orderBy: { date: "asc" } }),
    prisma.schoolClosure.findMany({ where: { date: { lt: today } }, orderBy: { date: "desc" }, take: 20 }),
  ]);

  return (
    <div className="stage-light flex-1 flex flex-col">
      <Nav name={user.name} title={user.title} isAdmin={true} active="calendar" />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">School calendar</h1>
          <p className="text-ink-soft text-sm mt-1">
            Dates here don&apos;t count against anyone&apos;s streak, same as Shabbos already doesn&apos;t.
          </p>
        </div>

        {params.added !== undefined && (
          <div className="rounded-2xl bg-good-bg text-good text-sm font-bold px-4 py-3 mb-5">
            Added {params.added} date{params.added === "1" ? "" : "s"}.
            {params.skipped && ` Skipped ${params.skipped} row(s) with an unreadable date.`}
          </div>
        )}
        {params.error && (
          <div className="rounded-2xl bg-crit-bg text-crit text-sm font-bold px-4 py-3 mb-5">{params.error}</div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start">
          <div className="glass-card rounded-[1.75rem] overflow-hidden">
            <div className="p-5 pb-0">
              <h2 className="font-extrabold text-ink text-sm">Upcoming closures</h2>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <tbody>
                  {upcoming.length === 0 && (
                    <tr>
                      <td className="px-5 py-6 text-center text-sm font-semibold text-ink-soft">
                        No upcoming closures on the calendar.
                      </td>
                    </tr>
                  )}
                  {upcoming.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 1 ? "bg-teal-100/20" : ""}>
                      <td className="px-5 py-3 font-bold text-ink">{formatClosureDate(c.date)}</td>
                      <td className="px-5 py-3 font-semibold text-ink-soft">{c.label || "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <form action={deleteClosure}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            className="rounded-lg px-3 py-1.5 text-xs font-bold text-crit bg-crit-bg cursor-pointer"
                          >
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {past.length > 0 && (
              <>
                <div className="p-5 pb-0 pt-6">
                  <h2 className="font-extrabold text-ink text-sm">Past</h2>
                </div>
                <div className="overflow-x-auto mt-4 mb-2">
                  <table className="w-full text-sm">
                    <tbody>
                      {past.map((c, i) => (
                        <tr key={c.id} className={i % 2 === 1 ? "bg-teal-100/20" : ""}>
                          <td className="px-5 py-3 font-semibold text-ink-soft">{formatClosureDate(c.date)}</td>
                          <td className="px-5 py-3 font-semibold text-ink-soft">{c.label || "—"}</td>
                          <td className="px-5 py-3 text-right">
                            <form action={deleteClosure}>
                              <input type="hidden" name="id" value={c.id} />
                              <button
                                type="submit"
                                className="rounded-lg px-3 py-1.5 text-xs font-bold text-crit bg-crit-bg cursor-pointer"
                              >
                                Remove
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="space-y-5">
            <div className="glass-card rounded-[1.5rem] p-5">
              <h2 className="font-extrabold text-ink text-sm mb-1">Upload a calendar</h2>
              <p className="text-xs font-semibold text-ink-soft mb-3">
                A CSV with columns: date (YYYY-MM-DD), and an optional label (e.g.
                &ldquo;Rosh Hashanah&rdquo;). Existing dates get their label updated, new ones are
                added.
              </p>
              <form action="/admin/calendar/upload" method="post" encType="multipart/form-data" className="space-y-3">
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
              <h2 className="font-extrabold text-ink text-sm mb-3">Add one date</h2>
              <form action={addClosure} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">Date</label>
                  <input type="date" name="date" required className="field w-full rounded-lg px-3 py-2 text-sm font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">
                    Label (optional)
                  </label>
                  <input
                    name="label"
                    placeholder="e.g. Winter Break"
                    className="field w-full rounded-lg px-3 py-2 text-sm font-semibold"
                  />
                </div>
                <button type="submit" className="btn-teal-gradient w-full rounded-xl py-2.5 text-sm font-bold text-white cursor-pointer">
                  Add
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
