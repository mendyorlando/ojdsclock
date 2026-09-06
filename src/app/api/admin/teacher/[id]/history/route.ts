import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

/** Admin-only: a single teacher's clock history, mirroring /api/me/history. */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const { id } = await context.params;
  const cursor = req.nextUrl.searchParams.get("cursor");

  // Optional date-range filter, matching the website's teacher-detail
  // "Filter" form - unfiltered (all history, paginated) when omitted.
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : null;
  const to = toParam ? new Date(`${toParam}T00:00:00`) : null;
  if (to) to.setDate(to.getDate() + 1); // make the "to" date inclusive

  const timestampFilter: { gte?: Date; lt?: Date } = {};
  if (from && !Number.isNaN(from.getTime())) timestampFilter.gte = from;
  if (to && !Number.isNaN(to.getTime())) timestampFilter.lt = to;

  const events = await prisma.clockEvent.findMany({
    where: {
      userId: id,
      ...(Object.keys(timestampFilter).length > 0 ? { timestamp: timestampFilter } : {}),
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = events.length > PAGE_SIZE;
  const page = events.slice(0, PAGE_SIZE);

  return NextResponse.json({
    events: page.map((e) => ({
      id: e.id,
      type: e.type,
      timestamp: e.timestamp.toISOString(),
      tagId: e.tagId,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
