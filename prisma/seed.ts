import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diffToMonday);
  return start;
}

function at(base: Date, dayOffset: number, hour: number, minute: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const FRONT = "chabad-door";
const SIDE = "ojds-door";

async function main() {
  const weekStart = startOfWeek(new Date());

  await prisma.pushSubscription.deleteMany();
  await prisma.session.deleteMany();
  await prisma.clockEvent.deleteMany();
  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: adminPasswordHash,
      name: "Office Admin",
      role: "ADMIN",
      title: "Front Office",
      payType: "HOURLY",
    },
  });

  const teacherPasswordHash = await bcrypt.hash("teacher123", 10);

  const teachers = [
    {
      username: "rklein",
      name: "Rivka Klein",
      title: "3rd Grade Teacher",
      payType: "HOURLY" as const,
      events: [
        [0, FRONT, 8, 2, 15, 31],
        [1, FRONT, 8, 5, 15, 20],
        [2, SIDE, 8, 0, 15, 35],
      ] as [number, string, number, number, number, number][],
      openToday: [FRONT, 8, 14] as [string, number, number],
    },
    {
      username: "dstern",
      name: "Dovid Stern",
      title: "5th Grade Teacher",
      payType: "HOURLY" as const,
      events: [
        [0, FRONT, 7, 55, 16, 5],
        [1, FRONT, 7, 58, 16, 0],
        [2, FRONT, 8, 0, 16, 10],
        [3, SIDE, 7, 50, 16, 0],
      ] as [number, string, number, number, number, number][],
      openToday: null,
    },
    {
      username: "slevi",
      name: "Sarah Levi",
      title: "Judaic Studies",
      payType: "PER_JOB" as const,
      events: [[0, SIDE, 8, 30, 14, 30]] as [number, string, number, number, number, number][],
      openToday: null,
    },
    {
      username: "mkatz",
      name: "Moshe Katz",
      title: "Math Department",
      payType: "HOURLY" as const,
      events: [
        [0, FRONT, 8, 10, 15, 40],
        [1, SIDE, 8, 5, 15, 35],
        [2, FRONT, 8, 0, 15, 30],
      ] as [number, string, number, number, number, number][],
      openToday: null,
    },
    {
      username: "cadler",
      name: "Chana Adler",
      title: "Art Teacher",
      payType: "PER_JOB" as const,
      events: [
        [0, FRONT, 9, 0, 16, 0],
        [1, FRONT, 9, 0, 16, 0],
        [2, FRONT, 9, 0, 16, 0],
      ] as [number, string, number, number, number, number][],
      openToday: null,
    },
    {
      username: "ybraun",
      name: "Yosef Braun",
      title: "Physical Education",
      payType: "HOURLY" as const,
      events: [
        [0, SIDE, 7, 30, 17, 0],
        [1, SIDE, 7, 30, 17, 0],
        [2, SIDE, 7, 30, 17, 0],
        [3, SIDE, 7, 30, 17, 0],
      ] as [number, string, number, number, number, number][],
      openToday: null,
    },
  ];

  for (const t of teachers) {
    const user = await prisma.user.create({
      data: {
        username: t.username,
        passwordHash: teacherPasswordHash,
        name: t.name,
        title: t.title,
        role: "TEACHER",
        payType: t.payType,
      },
    });

    for (const [dayOffset, tagId, inH, inM, outH, outM] of t.events) {
      await prisma.clockEvent.create({
        data: { userId: user.id, type: "IN", timestamp: at(weekStart, dayOffset, inH, inM), tagId },
      });
      await prisma.clockEvent.create({
        data: { userId: user.id, type: "OUT", timestamp: at(weekStart, dayOffset, outH, outM), tagId },
      });
    }

    if (t.openToday) {
      const [tagId, h, m] = t.openToday;
      const now = new Date();
      const todayOffset = Math.round((new Date(now.toDateString()).getTime() - weekStart.getTime()) / 86_400_000);
      await prisma.clockEvent.create({
        data: { userId: user.id, type: "IN", timestamp: at(weekStart, todayOffset, h, m), tagId },
      });
    }
  }

  console.log("Seeded admin + 6 teachers.");
  console.log("Login as admin / admin123, or e.g. rklein / teacher123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
