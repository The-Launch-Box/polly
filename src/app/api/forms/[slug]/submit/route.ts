import { NextResponse } from "next/server";
import { QuestionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnswerInput, QuestionOptions } from "@/lib/types";
import {
  isScaleOptions,
  isShortTextOptions,
  isSingleChoiceOptions,
} from "@/lib/types";

type SubmitBody = {
  answers: AnswerInput[];
};

function validateAnswer(
  type: QuestionType,
  options: QuestionOptions | null,
  value: unknown,
  required: boolean,
): string | null {
  if (value === null || value === undefined || value === "") {
    return required ? "This question is required." : null;
  }

  switch (type) {
    case QuestionType.SCALE: {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return "Scale answers must be a whole number.";
      }
      if (!isScaleOptions(options)) {
        return "Invalid scale configuration.";
      }
      if (value < options.min || value > options.max) {
        return `Value must be between ${options.min} and ${options.max}.`;
      }
      return null;
    }
    case QuestionType.SINGLE_CHOICE: {
      if (typeof value !== "string") {
        return "Choice answers must be a string value.";
      }
      if (!isSingleChoiceOptions(options)) {
        return "Invalid choice configuration.";
      }
      const valid = options.choices.some((choice) => choice.value === value);
      return valid ? null : "Invalid choice selected.";
    }
    case QuestionType.SHORT_TEXT: {
      if (typeof value !== "string") {
        return "Text answers must be a string.";
      }
      const trimmed = value.trim();
      if (!trimmed && required) {
        return "This question is required.";
      }
      if (isShortTextOptions(options) && options.maxLength && trimmed.length > options.maxLength) {
        return `Answer must be at most ${options.maxLength} characters.`;
      }
      return null;
    }
    default:
      return "Unsupported question type.";
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: "answers must be an array." },
      { status: 400 },
    );
  }

  const form = await prisma.form.findUnique({
    where: { slug },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  const answersByQuestion = new Map(
    body.answers.map((answer) => [answer.questionId, answer.value]),
  );

  const errors: Record<string, string> = {};

  for (const question of form.questions) {
    const value = answersByQuestion.get(question.id);
    const error = validateAnswer(
      question.type,
      question.options as QuestionOptions | null,
      value,
      question.required,
    );
    if (error) {
      errors[question.id] = error;
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.submission.create({
      data: {
        formId: form.id,
      },
    });

    const answerRows = form.questions
      .map((question) => {
        const rawValue = answersByQuestion.get(question.id);
        if (
          rawValue === null ||
          rawValue === undefined ||
          rawValue === "" ||
          (typeof rawValue === "string" && !rawValue.trim() && !question.required)
        ) {
          return null;
        }

        let storedValue: unknown = rawValue;
        if (question.type === QuestionType.SHORT_TEXT && typeof rawValue === "string") {
          storedValue = rawValue.trim();
        }
        if (question.type === QuestionType.SINGLE_CHOICE && typeof rawValue === "string") {
          const choiceOptions = question.options as {
            choices?: { value: string; label: string }[];
          } | null;
          const match = choiceOptions?.choices?.find(
            (choice) => choice.value === rawValue,
          );
          storedValue = match ?? rawValue;
        }

        return {
          submissionId: created.id,
          questionId: question.id,
          value: storedValue as object,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (answerRows.length > 0) {
      await tx.answer.createMany({ data: answerRows });
    }

    return created;
  });

  return NextResponse.json({
    submissionId: submission.id,
    submittedAt: submission.submittedAt,
  });
}
