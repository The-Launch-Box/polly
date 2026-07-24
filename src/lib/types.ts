import { QuestionType } from "@/generated/prisma/enums";

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

export type AttachmentKind = "image" | "video" | "document";

export type AttachmentOptions = {
  allowedKinds?: AttachmentKind[];
  maxSizeMb?: number;
};

export type AttachmentAnswer = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
};

export type NpsContactField = "name" | "email" | "company" | "title";

export type NpsLink = {
  label: string;
  url: string;
};

export type NpsOptions = {
  firmName: string;
  followUpPrompt?: string;
  promoterRedirectUrl?: string;
  contactFields?: NpsContactField[];
  closingLogoUrl?: string;
  closingTitle?: string;
  closingBody?: string;
  closingLinks?: NpsLink[];
};

export type NpsAnswer = {
  score: number;
  path: "promoter" | "detractor";
  followUpText?: string;
  contact?: Partial<Record<NpsContactField, string>>;
};

export type ContactInfoOptions = Record<string, never>;

export type ContactInfoAnswer = {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
};

export type QuestionOptions =
  | ScaleOptions
  | SingleChoiceOptions
  | MultipleChoiceOptions
  | ShortTextOptions
  | SliderOptions
  | HeatmapOptions
  | AttachmentOptions
  | NpsOptions
  | ContactInfoOptions;

export type BranchOperator =
  | "equals"
  | "not_equals"
  | "includes"
  | "not_includes"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "answered"
  | "not_answered";

export type BranchCondition = {
  // The id of an earlier question whose answer this condition inspects.
  questionId: string;
  operator: BranchOperator;
  // Comparison target. Omitted for the answered/not_answered operators.
  value?: string | number;
};

export type QuestionVisibility = {
  // "all" = every condition must hold (AND); "any" = at least one (OR).
  match: "all" | "any";
  conditions: BranchCondition[];
};

export type FormQuestion = {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  required: boolean;
  options: QuestionOptions | null;
  visibility: QuestionVisibility | null;
};

export const BRANCH_OPERATORS: readonly BranchOperator[] = [
  "equals",
  "not_equals",
  "includes",
  "not_includes",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "answered",
  "not_answered",
];

export function isBranchOperator(value: unknown): value is BranchOperator {
  return typeof value === "string" && BRANCH_OPERATORS.includes(value as BranchOperator);
}

export type FormPayload = {
  slug: string;
  title: string;
  description: string | null;
  themeId: string;
  anonymous: boolean;
  questions: FormQuestion[];
};

export type AnswerInput = {
  questionId: string;
  value: unknown;
  durationMs?: number;
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

export function isAttachmentOptions(
  options: QuestionOptions | null,
): options is AttachmentOptions {
  return (
    options !== null &&
    typeof options === "object" &&
    ("allowedKinds" in options || "maxSizeMb" in options)
  );
}

export function isNpsOptions(
  options: QuestionOptions | null,
): options is NpsOptions {
  return (
    options !== null &&
    typeof options === "object" &&
    "firmName" in options &&
    typeof (options as NpsOptions).firmName === "string"
  );
}

export function isNpsAnswer(value: unknown): value is NpsAnswer {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as NpsAnswer).score === "number" &&
    ((value as NpsAnswer).path === "promoter" ||
      (value as NpsAnswer).path === "detractor")
  );
}

export function isContactInfoAnswer(value: unknown): value is ContactInfoAnswer {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ContactInfoAnswer).firstName === "string" &&
    typeof (value as ContactInfoAnswer).lastName === "string" &&
    typeof (value as ContactInfoAnswer).email === "string" &&
    typeof (value as ContactInfoAnswer).businessName === "string"
  );
}

export function isAttachmentAnswer(value: unknown): value is AttachmentAnswer {
  return (
    typeof value === "object" &&
    value !== null &&
    "filename" in value &&
    typeof (value as AttachmentAnswer).filename === "string" &&
    "mimeType" in value &&
    typeof (value as AttachmentAnswer).mimeType === "string" &&
    "sizeBytes" in value &&
    typeof (value as AttachmentAnswer).sizeBytes === "number" &&
    "downloadUrl" in value &&
    typeof (value as AttachmentAnswer).downloadUrl === "string"
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
  if (isAttachmentAnswer(value)) {
    return value.filename;
  }
  if (isNpsAnswer(value)) {
    const parts = [`Score: ${value.score}/10`];
    if (value.followUpText) {
      parts.push(`Feedback: ${value.followUpText}`);
    }
    if (value.contact) {
      const contactParts = Object.entries(value.contact)
        .filter(([, entry]) => entry)
        .map(([key, entry]) => `${key}: ${entry}`);
      if (contactParts.length > 0) {
        parts.push(contactParts.join("; "));
      }
    }
    return parts.join(" · ");
  }
  if (isContactInfoAnswer(value)) {
    return `${value.firstName} ${value.lastName} · ${value.email} · ${value.businessName}`;
  }
  if (typeof value === "object" && value !== null && "label" in value) {
    return String((value as { label: string }).label);
  }
  return JSON.stringify(value);
}
