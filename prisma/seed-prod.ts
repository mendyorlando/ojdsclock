import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Creates (or updates the password of) the one admin account. Doesn't
// touch anything else, safe to run against a real database. Reads from
// env vars so no password ever gets committed to a file.
//
//   ADMIN_USERNAME=admin ADMIN_PASSWORD=... npx tsx prisma/seed-prod.ts

async function main() {
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error("Set ADMIN_PASSWORD before running this script.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const school = await prisma.school.findFirstOrThrow();

  const admin = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role: "ADMIN" },
    create: {
      username,
      passwordHash,
      name: "Office Admin",
      role: "ADMIN",
      title: "Front Office",
      payType: "HOURLY",
      schoolId: school.id,
    },
  });

  console.log(`Admin account ready: ${admin.username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
