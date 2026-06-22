import { QuestionType } from "@prisma/client";

export type ScaleOptions = {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
};

export type ChoiceOption = {
  value: string;
  label: string;
};

export type SingleChoiceOptions = {
  choices: ChoiceOption[];
};

export type ShortTextOptions = {
  placeholder?: string;
  maxLength?: number;
};

export type QuestionOptions =
  | ScaleOptions
  | SingleChoiceOptions
  | ShortTextOptions;

export type FormQuestion = {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  required: boolean;
  options: QuestionOptions | null;
};

export type FormPayload = {
  slug: string;
  title: string;
  description: string | null;
  questions: FormQuestion[];
};

export type AnswerInput = {
  questionId: string;
  value: unknown;
};

export function isScaleOptions(
  options: QuestionOptions | null,
): options is ScaleOptions {
  return (
    options !== null &&
    typeof options === "object" &&
    "min" in options &&
    "max" in options
  );
}

export function isSingleChoiceOptions(
  options: QuestionOptions | null,
): options is SingleChoiceOptions {
  return (
    options !== null &&
    typeof options === "object" &&
    "choices" in options &&
    Array.isArray((options as SingleChoiceOptions).choices)
  );
}

export function isShortTextOptions(
  options: QuestionOptions | null,
): options is ShortTextOptions {
  return (
    options !== null &&
    typeof options === "object" &&
    !("min" in options) &&
    !("choices" in options)
  );
}

export function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "label" in value) {
    return String((value as { label: string }).label);
  }
  return JSON.stringify(value);
}
