import { prisma } from "./prisma";
import {
  ORGANIZATIONS,
  isSafeTenantSchemaName,
  tenantSchemaName,
} from "./organizations";

/**
 * Create (or refresh structure of) a tenant schema by cloning survey DDL from
 * the public template tables that Prisma migrate manages.
 */
export async function ensureTenantSchema(schemaName: string): Promise<void> {
  if (!isSafeTenantSchemaName(schemaName)) {
    throw new Error(`Invalid tenant schema name: ${schemaName}`);
  }

  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  // Clone table structures (no data) from public template tables.
  const tables = [
    "Form",
    "Webhook",
    "Question",
    "Submission",
    "Answer",
    "Group",
    "GroupMembership",
    "FormAccess",
  ] as const;

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."${table}" (
        LIKE public."${table}" INCLUDING ALL
      )
    `);
  }

  // Recreate FKs inside the tenant schema (LIKE INCLUDING ALL copies indexes /
  // defaults / constraints that don't reference other tables; cross-table FKs
  // need to be re-pointed at tenant-local tables).
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      ALTER TABLE "${schemaName}"."Webhook" DROP CONSTRAINT IF EXISTS "Webhook_formId_fkey";
      ALTER TABLE "${schemaName}"."Webhook"
        ADD CONSTRAINT "Webhook_formId_fkey"
        FOREIGN KEY ("formId") REFERENCES "${schemaName}"."Form"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "${schemaName}"."Question" DROP CONSTRAINT IF EXISTS "Question_formId_fkey";
      ALTER TABLE "${schemaName}"."Question"
        ADD CONSTRAINT "Question_formId_fkey"
        FOREIGN KEY ("formId") REFERENCES "${schemaName}"."Form"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "${schemaName}"."Submission" DROP CONSTRAINT IF EXISTS "Submission_formId_fkey";
      ALTER TABLE "${schemaName}"."Submission"
        ADD CONSTRAINT "Submission_formId_fkey"
        FOREIGN KEY ("formId") REFERENCES "${schemaName}"."Form"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "${schemaName}"."Answer" DROP CONSTRAINT IF EXISTS "Answer_submissionId_fkey";
      ALTER TABLE "${schemaName}"."Answer"
        ADD CONSTRAINT "Answer_submissionId_fkey"
        FOREIGN KEY ("submissionId") REFERENCES "${schemaName}"."Submission"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "${schemaName}"."Answer" DROP CONSTRAINT IF EXISTS "Answer_questionId_fkey";
      ALTER TABLE "${schemaName}"."Answer"
        ADD CONSTRAINT "Answer_questionId_fkey"
        FOREIGN KEY ("questionId") REFERENCES "${schemaName}"."Question"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "${schemaName}"."GroupMembership" DROP CONSTRAINT IF EXISTS "GroupMembership_groupId_fkey";
      ALTER TABLE "${schemaName}"."GroupMembership"
        ADD CONSTRAINT "GroupMembership_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "${schemaName}"."Group"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "${schemaName}"."FormAccess" DROP CONSTRAINT IF EXISTS "FormAccess_formId_fkey";
      ALTER TABLE "${schemaName}"."FormAccess"
        ADD CONSTRAINT "FormAccess_formId_fkey"
        FOREIGN KEY ("formId") REFERENCES "${schemaName}"."Form"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "${schemaName}"."FormAccess" DROP CONSTRAINT IF EXISTS "FormAccess_groupId_fkey";
      ALTER TABLE "${schemaName}"."FormAccess"
        ADD CONSTRAINT "FormAccess_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "${schemaName}"."Group"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END $$;
  `);
}

export async function ensureAllTenantSchemas(): Promise<void> {
  for (const org of ORGANIZATIONS) {
    await ensureTenantSchema(tenantSchemaName(org.slug));
  }
}

/**
 * Upsert Organization rows for the canonical customer list and ensure their
 * Postgres schemas exist.
 */
export async function syncOrganizationsAndSchemas() {
  const results = [];

  for (const org of ORGANIZATIONS) {
    const schemaName = tenantSchemaName(org.slug);
    await ensureTenantSchema(schemaName);

    const row = await prisma.organization.upsert({
      where: { slug: org.slug },
      update: {
        name: org.name,
        emailDomain: org.emailDomain,
        schemaName,
      },
      create: {
        name: org.name,
        slug: org.slug,
        emailDomain: org.emailDomain,
        schemaName,
      },
    });

    results.push(row);
  }

  return results;
}

/**
 * Move any leftover survey rows from public template tables into a tenant
 * schema (used once during the multi-tenancy migration).
 */
export async function migratePublicSurveyDataToTenant(
  schemaName: string,
  ownerUserId: string,
): Promise<number> {
  if (!isSafeTenantSchemaName(schemaName)) {
    throw new Error(`Invalid tenant schema name: ${schemaName}`);
  }

  await ensureTenantSchema(schemaName);

  const forms = await prisma.$queryRawUnsafe<Array<{ id: string; slug: string }>>(
    `SELECT id, slug FROM public."Form"`,
  );

  if (forms.length === 0) {
    return 0;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE public."Form" SET "ownerUserId" = $1 WHERE "ownerUserId" IS NULL OR "ownerUserId" = '' OR "ownerUserId" = 'migration_placeholder_owner'`,
    ownerUserId,
  );

  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}"."Form"
    SELECT * FROM public."Form"
    ON CONFLICT ("id") DO NOTHING
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}"."Question"
    SELECT * FROM public."Question"
    ON CONFLICT ("id") DO NOTHING
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}"."Submission"
    SELECT * FROM public."Submission"
    ON CONFLICT ("id") DO NOTHING
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}"."Answer"
    SELECT * FROM public."Answer"
    ON CONFLICT ("id") DO NOTHING
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schemaName}"."Webhook"
    SELECT * FROM public."Webhook"
    ON CONFLICT ("id") DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE public."Answer" CASCADE`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE public."Submission" CASCADE`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE public."Webhook" CASCADE`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE public."Question" CASCADE`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE public."Form" CASCADE`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE public."FormAccess" CASCADE`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE public."GroupMembership" CASCADE`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE public."Group" CASCADE`);

  return forms.length;
}
