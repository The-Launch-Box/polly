import { prisma } from "@/lib/prisma";

/** Keep the public /q/[slug] index in sync with a tenant form. */
export async function upsertPublicFormRoute(input: {
  organizationId: string;
  formId: string;
  slug: string;
  previousSlug?: string;
}) {
  if (input.previousSlug && input.previousSlug !== input.slug) {
    await prisma.publicFormRoute.deleteMany({
      where: { slug: input.previousSlug, formId: input.formId },
    });
  }

  await prisma.publicFormRoute.upsert({
    where: { slug: input.slug },
    update: {
      organizationId: input.organizationId,
      formId: input.formId,
    },
    create: {
      slug: input.slug,
      organizationId: input.organizationId,
      formId: input.formId,
    },
  });
}

export async function deletePublicFormRoute(formId: string) {
  await prisma.publicFormRoute.deleteMany({ where: { formId } });
}
