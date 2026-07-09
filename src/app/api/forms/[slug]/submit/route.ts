import { NextResponse } from "next/server";
import { QuestionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fireWebhooks } from "@/lib/webhooks";
import type { AnswerInput, MultipleChoiceOptions, QuestionOptions } from "@/lib/types";
import {
  isChoiceListOptions,
  isHeatmapOptions,
  isHeatmapPoint,
  isScaleOptions,
  isShortTextOptions,
  isSliderOptions,
} from "@/lib/types";

type SubmitBody = {
  answers: AnswerInput[];
};

function isEmptyAnswer(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === "string" && !value.trim()) {
    return true;
  }
  return false;
}

function validateAnswer(
  type: QuestionType,
  options: QuestionOptions | null,
  value: unknown,
  required: boolean,
): string | null {
  if (isEmptyAnswer(value)) {
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
    case QuestionType.SLIDER: {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return "Slider answers must be a number.";
      }
      if (!isSliderOptions(options)) {
        return "Invalid slider configuration.";
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
      if (!isChoiceListOptions(options)) {
        return "Invalid choice configuration.";
      }
      const valid = options.choices.some((choice) => choice.value === value);
      return valid ? null : "Invalid choice selected.";
    }
    case QuestionType.MULTIPLE_CHOICE: {
      if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
        return "Multiple choice answers must be an array of choice values.";
      }
      if (!isChoiceListOptions(options)) {
        return "Invalid choice configuration.";
      }
      const multi = options as MultipleChoiceOptions;
      const min = multi.minSelections ?? 1;
      const max = multi.maxSelections ?? options.choices.length;
      if (value.length < min) {
        return `Select at least ${min} option${min === 1 ? "" : "s"}.`;
      }
      if (value.length > max) {
        return `Select at most ${max} option${max === 1 ? "" : "s"}.`;
      }
      const unique = new Set(value);
      if (unique.size !== value.length) {
        return "Duplicate choices are not allowed.";
      }
      for (const selected of value) {
        if (!options.choices.some((choice) => choice.value === selected)) {
          return "Invalid choice selected.";
        }
      }
      return null;
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
    case QuestionType.HEATMAP: {
      if (!isHeatmapOptions(options)) {
        return "Invalid heatmap configuration.";
      }
      const maxClicks = options.maxClicks ?? 1;
      if (maxClicks === 1) {
        if (!isHeatmapPoint(value)) {
          return "Heatmap answers must be a click position.";
        }
        return validateHeatmapPoint(value);
      }
      if (!Array.isArray(value) || !value.every(isHeatmapPoint)) {
        return "Heatmap answers must be click positions.";
      }
      if (value.length > maxClicks) {
        return `At most ${maxClicks} click${maxClicks === 1 ? "" : "s"} allowed.`;
      }
      for (const point of value) {
        const error = validateHeatmapPoint(point);
        if (error) {
          return error;
        }
      }
      return null;
    }
    default:
      return "Unsupported question type.";
  }
}

function validateHeatmapPoint(point: { x: number; y: number }): string | null {
  if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) {
    return "Heatmap coordinates must be between 0 and 100.";
  }
  return null;
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
        if (isEmptyAnswer(rawValue)) {
          return null;
        }

        let storedValue: unknown = rawValue;
        if (question.type === QuestionType.SHORT_TEXT && typeof rawValue === "string") {
          storedValue = rawValue.trim();
        }
        if (
          question.type === QuestionType.SINGLE_CHOICE &&
          typeof rawValue === "string"
        ) {
          const choiceOptions = question.options as QuestionOptions | null;
          if (isChoiceListOptions(choiceOptions)) {
            const match = choiceOptions.choices.find(
              (choice) => choice.value === rawValue,
            );
            storedValue = match ?? rawValue;
          }
        }
        if (
          question.type === QuestionType.MULTIPLE_CHOICE &&
          Array.isArray(rawValue)
        ) {
          const choiceOptions = question.options as QuestionOptions | null;
          if (isChoiceListOptions(choiceOptions)) {
            storedValue = rawValue.map((selected) => {
              const match = choiceOptions.choices.find(
                (choice) => choice.value === selected,
              );
              return match ?? selected;
            });
          }
        }
        if (question.type === QuestionType.HEATMAP && isHeatmapPoint(rawValue)) {
          storedValue = {
            x: Math.round(rawValue.x * 10) / 10,
            y: Math.round(rawValue.y * 10) / 10,
          };
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

  await fireWebhooks(form.id, slug, submission.id, submission.submittedAt);

  return NextResponse.json({
    submissionId: submission.id,
    submittedAt: submission.submittedAt,
  });
}
