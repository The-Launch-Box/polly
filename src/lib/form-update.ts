import { Prisma } from "@prisma/client";
import { normalizeFormInput, type UpdateFormInput } from "@/lib/form-create";
import { prisma } from "@/lib/prisma";

export class FormUpdateError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "SLUG_CONFLICT" | "INVALID_QUESTION" | "QUESTION_HAS_ANSWERS",
  ) {
    super(message);
    this.name = "FormUpdateError";
  }
}

export async function updateFormBySlug(
  currentSlug: string,
  input: UpdateFormInput,
) {
  const normalized = normalizeFormInput(input);

  return prisma.$transaction(async (tx) => {
    const form = await tx.form.findUnique({
      where: { slug: currentSlug },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!form) {
      throw new FormUpdateError("Form not found.", "NOT_FOUND");
    }

    if (normalized.slug !== currentSlug) {
      const slugTaken = await tx.form.findUnique({
        where: { slug: normalized.slug },
      });
      if (slugTaken) {
        throw new FormUpdateError(
          "A form with this URL slug already exists.",
          "SLUG_CONFLICT",
        );
      }
    }

    const existingById = new Map(form.questions.map((question) => [question.id, question]));

    for (const question of normalized.questions) {
      if (question.id && !existingById.has(question.id)) {
        throw new FormUpdateError("One or more questions are invalid.", "INVALID_QUESTION");
      }
    }

    const incomingIds = new Set(
      normalized.questions
        .map((question) => question.id)
        .filter((id): id is string => Boolean(id)),
    );

    const toRemove = form.questions.filter((question) => !incomingIds.has(question.id));

    for (const question of toRemove) {
      const answerCount = await tx.answer.count({
        where: { questionId: question.id },
      });
      if (answerCount > 0) {
        throw new FormUpdateError(
          `Cannot remove "${question.prompt}" because it already has responses.`,
          "QUESTION_HAS_ANSWERS",
        );
      }
    }

    if (toRemove.length > 0) {
      await tx.question.deleteMany({
        where: { id: { in: toRemove.map((question) => question.id) } },
      });
    }

    const remaining = form.questions.filter(
      (question) => !toRemove.some((removed) => removed.id === question.id),
    );

    for (const [index, question] of remaining.entries()) {
      await tx.question.update({
        where: { id: question.id },
        data: { order: 1000 + index },
      });
    }

    await tx.form.update({
      where: { id: form.id },
      data: {
        slug: normalized.slug,
        title: normalized.title,
        description: normalized.description,
        themeId: normalized.themeId ?? "default",
        anonymous: normalized.anonymous ?? false,
      },
    });

    for (const [index, question] of normalized.questions.entries()) {
      const data = {
        order: index + 1,
        type: question.type,
        prompt: question.prompt,
        required: question.required,
        options: question.options as Prisma.InputJsonValue,
      };

      if (question.id) {
        await tx.question.update({
          where: { id: question.id },
          data,
        });
      } else {
        await tx.question.create({
          data: {
            ...data,
            formId: form.id,
          },
        });
      }
    }

    return tx.form.findUnique({
      where: { id: form.id },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });
  });
}
