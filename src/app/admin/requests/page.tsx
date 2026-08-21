import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { approveRequest, denyRequest } from "./actions";

function formatRange(start: Date, end: Date) {
  const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t1 = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${t1} to ${t2}`;
}

export default async function RequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/requests");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [pending, resolved] = await Promise.all([
    prisma.correctionRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.correctionRequest.findMany({
      where: { status: { not: "PENDING" } },
      include: { user: true },
      orderBy: { resolvedAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="stage-light flex-1 flex flex-col">
      <Nav name={user.name} title={user.title} isAdmin={true} active="requests" />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Hour correction requests</h1>
          <p className="text-ink-soft text-sm mt-1">
            {pending.length} pending, approving adds only the time not already on record.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {pending.length === 0 && (
            <div className="glass-card rounded-2xl p-5 text-sm font-semibold text-ink-soft">
              No pending requests.
            </div>
          )}
          {pending.map((r) => (
            <div key={r.id} className="glass-card rounded-2xl p-5 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-extrabold text-ink">
                  <Link href={`/admin/teacher/${r.user.id}`} className="hover:underline">
                    {r.user.name}
                  </Link>
                </p>
                <p className="text-sm font-bold text-ink-soft mt-0.5">
                  {formatRange(r.requestedStart, r.requestedEnd)}
                </p>
                <p className="text-sm text-ink mt-1.5 font-semibold">&ldquo;{r.reason}&rdquo;</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <form action={approveRequest}>
                  <input type="hidden" name="requestId" value={r.id} />
                  <button
                    type="submit"
                    className="btn-teal-gradient rounded-xl px-4 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    Approve
                  </button>
                </form>
                <form action={denyRequest}>
                  <input type="hidden" name="requestId" value={r.id} />
                  <button
                    type="submit"
                    className="rounded-xl px-4 py-2 text-xs font-bold text-crit bg-crit-bg cursor-pointer"
                  >
                    Deny
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>

        {resolved.length > 0 && (
          <>
            <h2 className="text-sm font-extrabold text-ink-soft uppercase tracking-wider mb-3">
              Recently resolved
            </h2>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {resolved.map((r, i) => (
                      <tr key={r.id} className={i % 2 === 1 ? "bg-teal-100/20" : ""}>
                        <td className="px-4 py-3 font-bold text-ink">{r.user.name}</td>
                        <td className="px-4 py-3 font-semibold text-ink-soft">
                          {formatRange(r.requestedStart, r.requestedEnd)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full text-xs font-extrabold px-3 py-1 ${
                              r.status === "APPROVED" ? "bg-good-bg text-good" : "bg-crit-bg text-crit"
                            }`}
                          >
                            {r.status === "APPROVED" ? "Approved" : "Denied"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
