-- AlterTable
ALTER TABLE "User" ADD COLUMN     "boundDeviceId" TEXT;

-- CreateTable
CREATE TABLE "DeviceRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceRequest_userId_status_idx" ON "DeviceRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "DeviceRequest" ADD CONSTRAINT "DeviceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
