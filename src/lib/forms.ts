import { prisma } from "@/lib/prisma";
import type {
  FormPayload,
  QuestionOptions,
  QuestionVisibility,
} from "@/lib/types";

export async function getFormBySlug(slug: string): Promise<FormPayload | null> {
  const form = await prisma.form.findUnique({
    where: { slug },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
    },
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
