import { NextResponse } from "next/server";
import { QuestionType } from "@/generated/prisma/enums";
import { validateAttachmentFile } from "@/lib/attachments-shared";
import { saveAttachmentFile } from "@/lib/attachments";
import { prisma } from "@/lib/prisma";
import { fireWebhooks } from "@/lib/webhooks";
import { getVisibleQuestionIds } from "@/lib/branching";
import type {
  AnswerInput,
  MultipleChoiceOptions,
  QuestionOptions,
  QuestionVisibility,
} from "@/lib/types";
import {
  isAttachmentOptions,
  isChoiceListOptions,
  isHeatmapOptions,
  isHeatmapPoint,
  isNpsOptions,
  isScaleOptions,
  isShortTextOptions,
  isSliderOptions,
} from "@/lib/types";
import { validateNpsAnswer } from "@/lib/nps";
import { validateContactInfoAnswer, normalizeContactInfoAnswer, isContactInfoAnswer, isContactInfoComplete } from "@/lib/contact-info";
import {
  sanitizeAnswerValueForAnonymous,
  stripSubmissionTiming,
} from "@/lib/anonymity";

type SubmitBody = {
  answers: AnswerInput[];
  totalDurationMs?: number;
};

export const runtime = "nodejs";

type ParsedSubmitBody = {
  body: SubmitBody;
  filesByQuestion: Map<string, File>;
};

const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

function normalizeDurationMs(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return Math.min(value, MAX_DURATION_MS);
}

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

async function parseSubmitBody(request: Request): Promise<ParsedSubmitBody> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload = formData.get("payload");
    if (typeof payload !== "string") {
      throw new Error("Invalid multipart payload.");
    }

    const parsed = JSON.parse(payload) as SubmitBody;
    const filesByQuestion = new Map<string, File>();
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("attachment:") && value instanceof File) {
        filesByQuestion.set(key.replace("attachment:", ""), value);
      }
    }

    return { body: parsed, filesByQuestion };
  }

  return {
    body: (await request.json()) as SubmitBody,
    filesByQuestion: new Map<string, File>(),
  };
}

function validateAnswer(
  type: QuestionType,
  options: QuestionOptions | null,
  value: unknown,
  required: boolean,
  anonymous = false,
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
    case QuestionType.ATTACHMENT: {
      if (!(value instanceof File)) {
        return "Attachment answers must include a file.";
      }
      if (!isAttachmentOptions(options)) {
        return "Invalid attachment configuration.";
      }
      return validateAttachmentFile(value, options);
    }
    case QuestionType.NPS: {
      if (!isNpsOptions(options)) {
        return "Invalid NPS configuration.";
      }
      return validateNpsAnswer(value, options, required, anonymous);
    }
    case QuestionType.CONTACT_INFO: {
      return validateContactInfoAnswer(value, required, anonymous);
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

  let parsed: ParsedSubmitBody;
  try {
    parsed = await parseSubmitBody(request);
  } catch {
    return NextResponse.json({ error: "Invalid submission payload." }, { status: 400 });
  }

  const { body: rawBody, filesByQuestion } = parsed;

  if (!Array.isArray(rawBody.answers)) {
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

  const body = stripSubmissionTiming(rawBody, form.anonymous);

  const answersByQuestion = new Map(
    body.answers.map((answer) => [answer.questionId, answer]),
  );

  // Resolve which questions are actually reachable given the submitted answers
  // so hidden branches are neither required nor stored.
  const rawValueFor = (question: (typeof form.questions)[number]): unknown =>
    question.type === QuestionType.ATTACHMENT
      ? filesByQuestion.get(question.id)
      : answersByQuestion.get(question.id)?.value;

  const answersForVisibility: Record<string, unknown> = {};
  for (const question of form.questions) {
    answersForVisibility[question.id] = rawValueFor(question);
  }

  const visibleQuestionIds = getVisibleQuestionIds(
    form.questions.map((question) => ({
      id: question.id,
      order: question.order,
      type: question.type,
      prompt: question.prompt,
      required: question.required,
      options: question.options as QuestionOptions | null,
      visibility: question.visibility as QuestionVisibility | null,
    })),
    answersForVisibility,
  );

  const errors: Record<string, string> = {};

  for (const question of form.questions) {
    if (!visibleQuestionIds.has(question.id)) {
      continue;
    }
    const answer = answersByQuestion.get(question.id);
    const value =
      question.type === QuestionType.ATTACHMENT
        ? filesByQuestion.get(question.id)
        : answer?.value;
    const error = validateAnswer(
      question.type,
      question.options as QuestionOptions | null,
      value,
      question.required,
      form.anonymous,
    );
    if (error) {
      errors[question.id] = error;
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  try {
    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: {
          formId: form.id,
          totalDurationMs: form.anonymous
            ? null
            : normalizeDurationMs(body.totalDurationMs),
        },
      });

      const answerRows = await Promise.all(
        form.questions.map(async (question) => {
          if (!visibleQuestionIds.has(question.id)) {
            return null;
          }
          const answer = answersByQuestion.get(question.id);
          const rawValue =
            question.type === QuestionType.ATTACHMENT
              ? filesByQuestion.get(question.id)
              : answer?.value;
          if (isEmptyAnswer(rawValue)) {
            return null;
          }
          if (
            question.type === QuestionType.CONTACT_INFO &&
            isContactInfoAnswer(rawValue) &&
            !isContactInfoComplete(rawValue) &&
            !question.required
          ) {
            return null;
          }

          let storedValue: unknown = sanitizeAnswerValueForAnonymous(
            question.type,
            rawValue,
          );
          if (question.type === QuestionType.SHORT_TEXT && typeof storedValue === "string") {
            storedValue = storedValue.trim();
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
          if (question.type === QuestionType.ATTACHMENT && rawValue instanceof File) {
            storedValue = await saveAttachmentFile({
              submissionId: created.id,
              questionId: question.id,
              file: rawValue,
            });
          }
          if (question.type === QuestionType.NPS && typeof storedValue === "object" && storedValue) {
            const npsValue = storedValue as {
              score: number;
              path: string;
              followUpText?: string;
            };
            storedValue = {
              score: npsValue.score,
              path: npsValue.path,
              ...(npsValue.followUpText?.trim()
                ? { followUpText: npsValue.followUpText.trim() }
                : {}),
            };
          }
          if (
            question.type === QuestionType.CONTACT_INFO &&
            isContactInfoAnswer(storedValue)
          ) {
            storedValue = normalizeContactInfoAnswer(storedValue);
          }

          return {
            submissionId: created.id,
            questionId: question.id,
            value: storedValue as object,
            durationMs: form.anonymous
              ? null
              : normalizeDurationMs(answer?.durationMs),
          };
        }),
      );

      const nonNullAnswerRows = answerRows.filter(
        (row): row is NonNullable<typeof row> => row !== null,
      );

      if (nonNullAnswerRows.length > 0) {
        await tx.answer.createMany({ data: nonNullAnswerRows });
      }

      return created;
    });

    await fireWebhooks(form.id, slug, submission.id, submission.submittedAt);

    return NextResponse.json({
      submissionId: submission.id,
      submittedAt: submission.submittedAt,
    });
  } catch (error) {
    console.error("Failed to save submission:", error);
    if (error && typeof error === "object" && "code" in error) {
      console.error("Save failure code:", (error as { code?: string }).code);
    }
    return NextResponse.json(
      { error: "Could not save your response. Please try again." },
      { status: 500 },
    );
  }
}
