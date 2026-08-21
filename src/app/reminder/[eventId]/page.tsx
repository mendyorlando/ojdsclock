import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tagLabel } from "@/lib/tags";
import { ClockIcon } from "@/components/icons";
import { confirmClockOut } from "./actions";

export default async function ReminderPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/reminder/${eventId}`)}`);

  const event = await prisma.clockEvent.findUnique({ where: { id: eventId } });
  const last = await prisma.clockEvent.findFirst({
    where: { userId: user.id },
    orderBy: { timestamp: "desc" },
  });

  const stillOpen = Boolean(event) && event!.userId === user.id && last?.id === event!.id && event!.type === "IN";

  const hoursSince = event ? Math.round(((Date.now() - event.timestamp.getTime()) / 3_600_000) * 10) / 10 : 0;

  return (
    <main className="stage-dark flex-1 flex items-center justify-center px-6 py-16">
      <div className="relative z-10 w-full max-w-sm text-center">
        <div className="mx-auto mb-6 h-20 w-20 rounded-full glass-dark grid place-items-center">
          <ClockIcon className="h-9 w-9 text-orange-400" />
        </div>

        {!stillOpen ? (
          <>
            <h1 className="text-2xl font-extrabold text-white tracking-tight text-balance">
              All set, you're already clocked out
            </h1>
            <p className="text-teal-100/60 text-sm mt-2 font-semibold">
              No action needed here.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-white tracking-tight text-balance">
              Still at school?
            </h1>
            <p className="text-teal-100/60 text-sm mt-2 font-semibold">
              You clocked in at {tagLabel(event!.tagId)} about {hoursSince} hours ago and haven&apos;t
              clocked out yet.
            </p>

            <div className="mt-7 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="btn-teal-gradient rounded-xl px-6 py-3 text-sm font-bold text-white"
              >
                Yes, still here
              </Link>
              <form action={confirmClockOut}>
                <input type="hidden" name="eventId" value={event!.id} />
                <button
                  type="submit"
                  className="btn-gradient w-full rounded-xl px-6 py-3 text-sm font-bold text-white cursor-pointer"
                >
                  No, clock me out
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
