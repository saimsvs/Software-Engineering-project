-- Defaults are intentionally restrictive. Only opted-in location contributions may enter aggregate maps.
CREATE TABLE "PrivacySetting" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "locationSharingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "showTrendsPublic" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivacySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Goal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "targetValue" DOUBLE PRECISION NOT NULL,
  "targetUnit" VARCHAR(32) NOT NULL,
  "deadline" TIMESTAMP(3) NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Goal_userId_createdAt_idx" ON "Goal"("userId", "createdAt");
