import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor");

  const events = await prisma.clockEvent.findMany({
    where: { userId: user.id },
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
