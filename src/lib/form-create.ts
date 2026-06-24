import { QuestionType } from "@prisma/client";
import type {
  QuestionOptions,
  ScaleOptions,
  SingleChoiceOptions,
  ShortTextOptions,
} from "@/lib/types";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type FormQuestionInput = {
  id?: string;
  order: number;
  type: QuestionType;
  prompt: string;
  required: boolean;
  options: QuestionOptions;
};

export type FormInput = {
  slug: string;
  title: string;
  description?: string | null;
  questions: FormQuestionInput[];
};

export type CreateFormInput = FormInput;
export type UpdateFormInput = FormInput;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function defaultOptionsForType(type: QuestionType): QuestionOptions {
  switch (type) {
    case QuestionType.SCALE:
      return { min: 1, max: 5, minLabel: "", maxLabel: "" };
    case QuestionType.SINGLE_CHOICE:
      return {
        choices: [
          { value: "option-1", label: "Option 1" },
          { value: "option-2", label: "Option 2" },
        ],
      };
    case QuestionType.SHORT_TEXT:
      return { placeholder: "", maxLength: 500 };
    default:
      return { placeholder: "" };
  }
}

export function validateFormInput(input: FormInput): Record<string, string> {
  const errors: Record<string, string> = {};

  const slug = input.slug?.trim() ?? "";
  if (!slug) {
    errors.slug = "URL slug is required.";
  } else if (slug.length > 64) {
    errors.slug = "URL slug must be at most 64 characters.";
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug =
      "URL slug must use lowercase letters, numbers, and hyphens only.";
  }

  const title = input.title?.trim() ?? "";
  if (!title) {
    errors.title = "Title is required.";
  } else if (title.length > 200) {
    errors.title = "Title must be at most 200 characters.";
  }

  if (input.description && input.description.length > 1000) {
    errors.description = "Description must be at most 1000 characters.";
  }

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    errors.questions = "Add at least one question.";
    return errors;
  }

  input.questions.forEach((question, index) => {
    const prefix = `questions.${index}`;

    if (!question.prompt?.trim()) {
      errors[`${prefix}.prompt`] = "Question prompt is required.";
    } else if (question.prompt.length > 500) {
      errors[`${prefix}.prompt`] = "Prompt must be at most 500 characters.";
    }

    if (question.order !== index + 1) {
      errors[`${prefix}.order`] = "Question order must be sequential.";
    }

    const optionError = validateQuestionOptions(question.type, question.options);
    if (optionError) {
      errors[`${prefix}.options`] = optionError;
    }
  });

  return errors;
}

function validateQuestionOptions(
  type: QuestionType,
  options: QuestionOptions,
): string | null {
  switch (type) {
    case QuestionType.SCALE: {
      const scale = options as ScaleOptions;
      if (
        typeof scale.min !== "number" ||
        typeof scale.max !== "number" ||
        !Number.isInteger(scale.min) ||
        !Number.isInteger(scale.max)
      ) {
        return "Scale min and max must be whole numbers.";
      }
      if (scale.min >= scale.max) {
        return "Scale max must be greater than min.";
      }
      if (scale.max - scale.min > 10) {
        return "Scale range can span at most 10 points.";
      }
      return null;
    }
    case QuestionType.SINGLE_CHOICE: {
      const choice = options as SingleChoiceOptions;
      if (!Array.isArray(choice.choices) || choice.choices.length < 2) {
        return "Add at least two choices.";
      }
      const values = new Set<string>();
      for (const item of choice.choices) {
        if (!item.label?.trim()) {
          return "Each choice needs a label.";
        }
        const value = item.value?.trim();
        if (!value) {
          return "Each choice needs a value.";
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return "Choice values must use lowercase letters, numbers, and hyphens.";
        }
        if (values.has(value)) {
          return "Choice values must be unique.";
        }
        values.add(value);
      }
      return null;
    }
    case QuestionType.SHORT_TEXT: {
      const text = options as ShortTextOptions;
      if (
        text.maxLength !== undefined &&
        (!Number.isInteger(text.maxLength) || text.maxLength < 1)
      ) {
        return "Max length must be a positive number.";
      }
      return null;
    }
    default:
      return "Unsupported question type.";
  }
}

export const validateCreateFormInput = validateFormInput;

export function normalizeFormInput(input: FormInput): FormInput {
  return {
    slug: input.slug.trim(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    questions: input.questions.map((question, index) => ({
      ...(question.id ? { id: question.id } : {}),
      order: index + 1,
      type: question.type,
      prompt: question.prompt.trim(),
      required: question.required,
      options: normalizeQuestionOptions(question.type, question.options),
    })),
  };
}

export const normalizeCreateFormInput = normalizeFormInput;

function normalizeQuestionOptions(
  type: QuestionType,
  options: QuestionOptions,
): QuestionOptions {
  switch (type) {
    case QuestionType.SCALE: {
      const scale = options as ScaleOptions;
      return {
        min: scale.min,
        max: scale.max,
        ...(scale.minLabel?.trim()
          ? { minLabel: scale.minLabel.trim() }
          : {}),
        ...(scale.maxLabel?.trim()
          ? { maxLabel: scale.maxLabel.trim() }
          : {}),
      };
    }
    case QuestionType.SINGLE_CHOICE: {
      const choice = options as SingleChoiceOptions;
      return {
        choices: choice.choices.map((item) => ({
          value: item.value.trim(),
          label: item.label.trim(),
        })),
      };
    }
    case QuestionType.SHORT_TEXT: {
      const text = options as ShortTextOptions;
      return {
        ...(text.placeholder?.trim()
          ? { placeholder: text.placeholder.trim() }
          : {}),
        ...(text.maxLength ? { maxLength: text.maxLength } : {}),
      };
    }
    default:
      return options;
  }
}
