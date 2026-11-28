-- AlterTable
ALTER TABLE "PrivacySetting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "targetUnit" VARCHAR(32) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "activityRules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Challenge_startDate_endDate_idx" ON "Challenge"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Challenge_organizerId_idx" ON "Challenge"("organizerId");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("organizerId") ON DELETE RESTRICT ON UPDATE CASCADE;
