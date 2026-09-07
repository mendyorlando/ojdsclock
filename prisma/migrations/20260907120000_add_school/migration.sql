-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#17ab9d',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 150,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "School" ENABLE ROW LEVEL SECURITY;

-- Seed the one school that exists today, using the coordinates that used
-- to live only in SCHOOL_LAT/SCHOOL_LNG/SCHOOL_RADIUS_METERS env vars, and
-- the logo already deployed as a public asset.
INSERT INTO "School" ("id", "name", "logoUrl", "latitude", "longitude", "radiusMeters")
VALUES (
    'ojds-winter-garden',
    'OJDS',
    'https://ojdsclock.vercel.app/full-ojds-logo.png',
    28.4504497,
    -81.4825767,
    700
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "schoolId" TEXT;
UPDATE "User" SET "schoolId" = 'ojds-winter-garden';
ALTER TABLE "User" ALTER COLUMN "schoolId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
