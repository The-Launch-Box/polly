-- AlterTable Group: drop global slug unique, add organizationId
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Group" SET "organizationId" = 'pending' WHERE "organizationId" IS NULL;
ALTER TABLE "Group" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "Group_slug_key";
CREATE INDEX IF NOT EXISTS "Group_organizationId_idx" ON "Group"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "Group_organizationId_slug_key" ON "Group"("organizationId", "slug");

-- AlterTable Form: add organizationId with backfill placeholder then tighten
ALTER TABLE "Form" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Form" SET "organizationId" = 'pending' WHERE "organizationId" IS NULL OR "organizationId" = '';
ALTER TABLE "Form" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Form_organizationId_idx" ON "Form"("organizationId");
