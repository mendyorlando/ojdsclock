import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { submitCorrectionRequest } from "./actions";

function formatRange(start: Date, end: Date) {
  const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t1 = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${t1} to ${t2}`;
}

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "bg-teal-100/60 text-ink-soft",
  APPROVED: "bg-good-bg text-good",
  DENIED: "bg-crit-bg text-crit",
};

export default async function RequestCorrectionPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/request");
  if (user.role === "ADMIN") redirect("/admin");

  const params = await searchParams;

  const myRequests = await prisma.correctionRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="stage-light flex-1 flex flex-col">
      <Nav name={user.name} title={user.title} isAdmin={false} active="dashboard" />

      <main className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-8 flex-1 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Request an hour correction</h1>
          <p className="text-ink-soft text-sm mt-1">
            Missed a tap? Tell us the day, why, and the full time you were at school, from when
            you arrived to when you left, not just the part that's missing, and an admin will
            review it.
          </p>
        </div>

        {params.submitted && (
          <div className="rounded-2xl bg-good-bg text-good text-sm font-bold px-4 py-3">
            Request sent. You&apos;ll see it below once an admin reviews it.
          </div>
        )}

        <form action={submitCorrectionRequest} className="glass-card rounded-[1.5rem] p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">Date</label>
            <input type="date" name="date" required className="field w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">From</label>
              <input type="time" name="startTime" required className="field w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">To</label>
              <input type="time" name="endTime" required className="field w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold" />
            </div>
          </div>
          <p className="text-xs font-semibold text-ink-faint -mt-2">
            Enter your total time for the whole day, start to finish, not just the hours that
            are missing.
          </p>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">Reason</label>
            <textarea
              name="reason"
              required
              rows={3}
              placeholder="e.g. Forgot to tap out at the end of the day"
              className="field w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold resize-none"
            />
          </div>
          <button type="submit" className="btn-gradient w-full rounded-xl py-3 text-sm font-bold text-white cursor-pointer">
            Submit request
          </button>
        </form>

        {myRequests.length > 0 && (
          <div>
            <h2 className="text-sm font-extrabold text-ink-soft uppercase tracking-wider mb-3">Your requests</h2>
            <div className="space-y-2">
              {myRequests.map((r) => (
                <div key={r.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{formatRange(r.requestedStart, r.requestedEnd)}</p>
                    <p className="text-xs font-semibold text-ink-soft mt-0.5 truncate">&ldquo;{r.reason}&rdquo;</p>
                  </div>
                  <span className={`rounded-full text-xs font-extrabold px-3 py-1 shrink-0 ${STATUS_CLASSES[r.status]}`}>
                    {r.status === "PENDING" ? "Pending" : r.status === "APPROVED" ? "Approved" : "Denied"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
