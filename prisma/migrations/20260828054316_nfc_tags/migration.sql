-- CreateTable
CREATE TABLE "NfcTag" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lastCounter" INTEGER NOT NULL DEFAULT -1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfcTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NfcTag_uid_key" ON "NfcTag"("uid");

-- Every table gets Row-Level Security enabled (see the earlier
-- enable_row_level_security migration for why); this only blocks
-- Supabase's public REST API, Prisma connects as the table owner and is
-- unaffected.
ALTER TABLE "NfcTag" ENABLE ROW LEVEL SECURITY;
