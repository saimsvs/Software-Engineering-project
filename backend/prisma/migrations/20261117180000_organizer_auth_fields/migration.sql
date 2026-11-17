-- Organizer got name/passwordHash and its id was renamed to organizerId in
-- schema.prisma without a migration (older databases were updated with db push).
-- Written to be safe on both a fresh database and one that already has these columns.

ALTER TABLE "Organizer" DROP CONSTRAINT IF EXISTS "Organizer_pkey";
ALTER TABLE "Organizer" DROP COLUMN IF EXISTS "id";
ALTER TABLE "Organizer" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;
ALTER TABLE "Organizer" ADD COLUMN IF NOT EXISTS "organizerId" TEXT NOT NULL;
ALTER TABLE "Organizer" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT NOT NULL;
ALTER TABLE "Organizer" ADD CONSTRAINT "Organizer_pkey" PRIMARY KEY ("organizerId");

CREATE UNIQUE INDEX IF NOT EXISTS "Organizer_organizerId_key" ON "Organizer"("organizerId");
