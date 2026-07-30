import type { QuestionType } from "@/generated/prisma/enums";

/** Answerable question types shown in the builder type dropdown. */
export const QUESTION_TYPE_VALUES = [
  "SCALE",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_TEXT",
  "SLIDER",
  "HEATMAP",
  "ATTACHMENT",
  "NPS",
  "CONTACT_INFO",
] as const;

/** All persisted question types, including structural SECTION markers. */
export const ALL_QUESTION_TYPE_VALUES = [
  ...QUESTION_TYPE_VALUES,
  "SECTION",
] as const;

export type QuestionTypeValue = (typeof ALL_QUESTION_TYPE_VALUES)[number];
export type AnswerableQuestionTypeValue = (typeof QUESTION_TYPE_VALUES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionTypeValue, string> = {
  SCALE: "Scale (1–5)",
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  SHORT_TEXT: "Short text",
  SLIDER: "Slider",
  HEATMAP: "Heatmap",
  ATTACHMENT: "Attachment",
  NPS: "NPS (0–10)",
  CONTACT_INFO: "Contact information",
  SECTION: "Section",
};

export function isAnswerableQuestionType(
  type: string,
): type is AnswerableQuestionTypeValue {
  return (QUESTION_TYPE_VALUES as readonly string[]).includes(type);
}

export function isSectionType(type: string): boolean {
  return type === "SECTION";
}

export function isQuestionTypeValue(value: string): value is QuestionTypeValue {
  return (ALL_QUESTION_TYPE_VALUES as readonly string[]).includes(value);
}

export function asQuestionType(value: string): QuestionType {
  if (!isQuestionTypeValue(value)) {
    throw new Error(`Unsupported question type: ${value}`);
  }

  return value;
}
