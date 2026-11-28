-- US21: coarse map area a user contributes to (never exact coordinates).
CREATE TABLE "AreaContribution" (
    "userId" TEXT NOT NULL,
    "areaKey" VARCHAR(32) NOT NULL,
    "areaLat" DOUBLE PRECISION NOT NULL,
    "areaLng" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaContribution_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "AreaContribution_areaKey_idx" ON "AreaContribution"("areaKey");

ALTER TABLE "AreaContribution" ADD CONSTRAINT "AreaContribution_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
