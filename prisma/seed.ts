import "dotenv/config";
import { PrismaClient, QuestionType } from "../src/generated/prisma/client";
import { createPrismaPgAdapter } from "../src/lib/pg-adapter";
import { syncOrganizationsAndSchemas } from "../src/lib/tenant-schema";
import { mirrorFormRowToTenant } from "../src/lib/tenant-pg";

const prisma = new PrismaClient({
  adapter: createPrismaPgAdapter(),
});

async function main() {
  console.log(
    `Seeding database (DATABASE_URL ${process.env.DATABASE_URL ? "is set" : "is MISSING"})…`,
  );

  const organizations = await syncOrganizationsAndSchemas();
  console.log(`Synced ${organizations.length} organizations + tenant schemas`);

  const improvizations = organizations.find((org) => org.slug === "improvizations");
  if (!improvizations) {
    throw new Error("Improvizations organization missing after sync");
  }

  const seedOwner = await prisma.user.upsert({
    where: { email: "seed@improvizations.com" },
    update: {},
    create: {
      email: "seed@improvizations.com",
      name: "Seed Owner",
      entraOid: "seed-improvizations-oid",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: seedOwner.id,
        organizationId: improvizations.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      userId: seedOwner.id,
      organizationId: improvizations.id,
      role: "OWNER",
    },
  });

  // Backfill any forms missing organization/owner onto Improvizations.
  await prisma.$executeRawUnsafe(
    `UPDATE "Form" SET "organizationId" = $1 WHERE "organizationId" IS NULL OR "organizationId" = '' OR "organizationId" = 'pending'`,
    improvizations.id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Form" SET "ownerUserId" = $1 WHERE "ownerUserId" IS NULL OR "ownerUserId" = '' OR "ownerUserId" = 'migration_placeholder_owner'`,
    seedOwner.id,
  );

  let form = await prisma.form.findUnique({ where: { slug: "claude-comfort" } });
  if (!form) {
    form = await prisma.form.create({
      data: {
        slug: "claude-comfort",
        title: "How comfortable with Claude are you?",
        description:
          "A quick internal survey about your experience with Claude.",
        organizationId: improvizations.id,
        ownerUserId: seedOwner.id,
        questions: {
          create: [
            {
              order: 1,
              type: QuestionType.SCALE,
              prompt: "How comfortable are you using Claude?",
              required: true,
              options: {
                min: 1,
                max: 5,
                minLabel: "Not comfortable",
                maxLabel: "Very comfortable",
              },
            },
            {
              order: 2,
              type: QuestionType.SINGLE_CHOICE,
              prompt: "How often do you use Claude?",
              required: true,
              options: {
                choices: [
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                  { value: "rarely", label: "Rarely" },
                  { value: "never", label: "Never" },
                ],
              },
            },
            {
              order: 3,
              type: QuestionType.SINGLE_CHOICE,
              prompt: "What is your primary use of Claude?",
              required: true,
              options: {
                choices: [
                  { value: "coding", label: "Coding & development" },
                  { value: "writing", label: "Writing & content" },
                  { value: "research", label: "Research & analysis" },
                  { value: "brainstorming", label: "Brainstorming & ideation" },
                  { value: "other", label: "Other" },
                ],
              },
            },
            {
              order: 4,
              type: QuestionType.SCALE,
              prompt:
                "How confident are you explaining Claude's capabilities to a colleague?",
              required: true,
              options: {
                min: 1,
                max: 5,
                minLabel: "Not confident",
                maxLabel: "Very confident",
              },
            },
            {
              order: 5,
              type: QuestionType.SHORT_TEXT,
              prompt:
                "Anything else you'd like to share about your experience? (optional)",
              required: false,
              options: {
                placeholder: "Your thoughts...",
                maxLength: 500,
              },
            },
          ],
        },
      },
    });
  } else {
    form = await prisma.form.update({
      where: { id: form.id },
      data: {
        title: "How comfortable with Claude are you?",
        description:
          "A quick internal survey about your experience with Claude.",
        organizationId: improvizations.id,
        ownerUserId: seedOwner.id,
      },
    });
  }

  const orgForms = await prisma.form.findMany({
    where: { organizationId: improvizations.id },
  });

  for (const orgForm of orgForms) {
    await prisma.publicFormRoute.upsert({
      where: { slug: orgForm.slug },
      update: {
        organizationId: improvizations.id,
        formId: orgForm.id,
      },
      create: {
        slug: orgForm.slug,
        organizationId: improvizations.id,
        formId: orgForm.id,
      },
    });
    await mirrorFormRowToTenant(improvizations.schemaName, orgForm);
  }

  console.log(
    `Seeded ${orgForms.length} form(s) for ${improvizations.slug}; demo slug=${form.slug}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
