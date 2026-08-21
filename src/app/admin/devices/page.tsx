import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { approveDevice, denyDevice } from "./actions";

function formatWhen(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function DevicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/devices");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [pending, resolved] = await Promise.all([
    prisma.deviceRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deviceRequest.findMany({
      where: { status: { not: "PENDING" } },
      include: { user: true },
      orderBy: { resolvedAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="stage-light flex-1 flex flex-col">
      <Nav name={user.name} title={user.title} isAdmin={true} active="devices" />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Device sign-in requests</h1>
          <p className="text-ink-soft text-sm mt-1">
            Each teacher account is locked to the first phone it signs in on. A sign-in attempt
            from a different phone shows up here instead of letting them in.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {pending.length === 0 && (
            <div className="glass-card rounded-2xl p-5 text-sm font-semibold text-ink-soft">
              No pending device requests.
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
                  Tried to sign in from {r.deviceLabel || "an unrecognized device"}
                </p>
                <p className="text-xs font-semibold text-ink-faint mt-1">{formatWhen(r.createdAt)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <form action={approveDevice}>
                  <input type="hidden" name="requestId" value={r.id} />
                  <button
                    type="submit"
                    className="btn-teal-gradient rounded-xl px-4 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    Approve this device
                  </button>
                </form>
                <form action={denyDevice}>
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
                          {r.deviceLabel || "Unrecognized device"}
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
