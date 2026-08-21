"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function confirmClockOut(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const eventId = String(formData.get("eventId") || "");
  const event = await prisma.clockEvent.findUnique({ where: { id: eventId } });

  if (event && event.userId === user.id && event.type === "IN") {
    const last = await prisma.clockEvent.findFirst({
      where: { userId: user.id },
      orderBy: { timestamp: "desc" },
    });
    if (last?.id === event.id) {
      await prisma.clockEvent.create({
        data: { userId: user.id, type: "OUT", tagId: "reminder-confirm" },
      });
    }
  }

  redirect("/dashboard");
}
