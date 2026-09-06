-- CreateTable
CREATE TABLE "ExpoPushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpoPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpoPushToken_token_key" ON "ExpoPushToken"("token");

-- AddForeignKey
ALTER TABLE "ExpoPushToken" ADD CONSTRAINT "ExpoPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Match this project's convention of enabling RLS on every table so
-- Supabase's public PostgREST API can't read/write it (see the
-- 20260825223100_enable_row_level_security migration).
ALTER TABLE "ExpoPushToken" ENABLE ROW LEVEL SECURITY;
