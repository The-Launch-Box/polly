import { prisma } from "@/lib/prisma";
import type {
  FormPayload,
  QuestionOptions,
  QuestionVisibility,
} from "@/lib/types";

export async function getFormBySlug(slug: string): Promise<FormPayload | null> {
  const route = await prisma.publicFormRoute.findUnique({
    where: { slug },
  });

  const form = route
    ? await prisma.form.findFirst({
        where: { id: route.formId, organizationId: route.organizationId },
        include: { questions: { orderBy: { order: "asc" } } },
      })
    : await prisma.form.findUnique({
        where: { slug },
        include: { questions: { orderBy: { order: "asc" } } },
      });

  if (!form) {
    return null;
  }

  return {
    slug: form.slug,
    title: form.title,
    description: form.description,
    themeId: form.themeId,
    anonymous: form.anonymous,
    questions: form.questions.map((question) => ({
      id: question.id,
      order: question.order,
      type: question.type,
      prompt: question.prompt,
      required: question.required,
      options: question.options as QuestionOptions | null,
      visibility: question.visibility as QuestionVisibility | null,
    })),
  };
}

export async function resolveFormRoute(slug: string) {
  return prisma.publicFormRoute.findUnique({
    where: { slug },
    include: { organization: true },
  });
}
