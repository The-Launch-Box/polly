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

export type MultipleChoiceOptions = {
  choices: ChoiceOption[];
  minSelections?: number;
  maxSelections?: number;
};

export type ShortTextOptions = {
  placeholder?: string;
  maxLength?: number;
};

export type SliderOptions = {
  min: number;
  max: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
};

export type HeatmapPoint = {
  x: number;
  y: number;
};

export type HeatmapOptions = {
  imageUrl: string;
  alt?: string;
  maxClicks?: number;
};

export type QuestionOptions =
  | ScaleOptions
  | SingleChoiceOptions
  | MultipleChoiceOptions
  | ShortTextOptions
  | SliderOptions
  | HeatmapOptions;

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
    "max" in options &&
    !("step" in options)
  );
}

export function isSliderOptions(
  options: QuestionOptions | null,
): options is SliderOptions {
  return (
    options !== null &&
    typeof options === "object" &&
    "min" in options &&
    "max" in options &&
    "step" in options
  );
}

export function isSingleChoiceOptions(
  options: QuestionOptions | null,
): options is SingleChoiceOptions {
  return (
    options !== null &&
    typeof options === "object" &&
    "choices" in options &&
    Array.isArray((options as SingleChoiceOptions).choices) &&
    !("minSelections" in options) &&
    !("maxSelections" in options)
  );
}

export function isMultipleChoiceOptions(
  options: QuestionOptions | null,
): options is MultipleChoiceOptions {
  return isChoiceListOptions(options);
}

// Multiple choice shares the same shape as single choice; disambiguate by question type.
export function isChoiceListOptions(
  options: QuestionOptions | null,
): options is SingleChoiceOptions | MultipleChoiceOptions {
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
    !("choices" in options) &&
    !("imageUrl" in options)
  );
}

export function isHeatmapOptions(
  options: QuestionOptions | null,
): options is HeatmapOptions {
  return (
    options !== null &&
    typeof options === "object" &&
    "imageUrl" in options &&
    typeof (options as HeatmapOptions).imageUrl === "string"
  );
}

export function isHeatmapPoint(value: unknown): value is HeatmapPoint {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as HeatmapPoint).x === "number" &&
    typeof (value as HeatmapPoint).y === "number"
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
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "—";
    }
    if (value.every((item) => typeof item === "string")) {
      return value.join(", ");
    }
    if (value.every((item) => typeof item === "object" && item !== null && "label" in item)) {
      return value.map((item) => String((item as { label: string }).label)).join(", ");
    }
    if (value.every(isHeatmapPoint)) {
      return value
        .map((point) => `(${point.x.toFixed(1)}%, ${point.y.toFixed(1)}%)`)
        .join("; ");
    }
    return JSON.stringify(value);
  }
  if (isHeatmapPoint(value)) {
    return `(${value.x.toFixed(1)}%, ${value.y.toFixed(1)}%)`;
  }
  if (typeof value === "object" && value !== null && "label" in value) {
    return String((value as { label: string }).label);
  }
  return JSON.stringify(value);
}
