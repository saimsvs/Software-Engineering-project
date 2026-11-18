-- Every user gets a unique, automatically generated username (e.g. "ali_7f3k")
-- so people with the same name can be told apart.

-- Clean up names saved with stray spaces (e.g. "Ali ").
UPDATE "User" SET "name" = btrim("name") WHERE "name" <> btrim("name");

ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill existing users: lowercase letters/digits from their name (max 15,
-- "user" if nothing is left) + "_" + 4 characters derived from their id.
UPDATE "User"
SET "username" =
  COALESCE(NULLIF(left(lower(regexp_replace("name", '[^a-zA-Z0-9]', '', 'g')), 15), ''), 'user')
  || '_' || substr(md5("id"), 1, 4)
WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
