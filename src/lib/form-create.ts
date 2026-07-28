import { QuestionType } from "@/generated/prisma/enums";
import { COMPANY_THEME_IDS, DEFAULT_THEME_ID } from "@/lib/company-themes";
import {
  isQuestionTypeValue,
  type QuestionTypeValue,
} from "@/lib/question-types";
import type {
  QuestionOptions,
  ScaleOptions,
  SingleChoiceOptions,
  MultipleChoiceOptions,
  ShortTextOptions,
  SliderOptions,
  HeatmapOptions,
  AttachmentOptions,
  NpsOptions,
  NpsContactField,
  ContactInfoOptions,
  QuestionVisibility,
  BranchCondition,
} from "@/lib/types";
import { isBranchOperator } from "@/lib/types";
import { operatorRequiresValue, operatorsForType } from "@/lib/branching";
import {
  DEFAULT_NPS_CLOSING_BODY,
  DEFAULT_NPS_CLOSING_TITLE,
  DEFAULT_NPS_FOLLOW_UP_PROMPT,
} from "@/lib/nps";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type FormQuestionInput = {
  id?: string;
  order: number;
  type: QuestionType;
  prompt: string;
  required: boolean;
  options: QuestionOptions;
  visibility?: QuestionVisibility | null;
};

export type FormInput = {
  slug: string;
  title: string;
  description?: string | null;
  themeId?: string;
  anonymous?: boolean;
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
  if (!isQuestionTypeValue(type)) {
    return { placeholder: "" };
  }

  switch (type as QuestionTypeValue) {
    case "SCALE":
      return { min: 1, max: 5, minLabel: "", maxLabel: "" };
    case "SINGLE_CHOICE":
      return {
        choices: [
          { value: "option-1", label: "Option 1" },
          { value: "option-2", label: "Option 2" },
        ],
      };
    case "MULTIPLE_CHOICE":
      return {
        choices: [
          { value: "option-1", label: "Option 1" },
          { value: "option-2", label: "Option 2" },
          { value: "option-3", label: "Option 3" },
        ],
      };
    case "SHORT_TEXT":
      return { placeholder: "", maxLength: 500 };
    case "SLIDER":
      return { min: 0, max: 100, step: 1, minLabel: "", maxLabel: "" };
    case "HEATMAP":
      return {
        imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
        alt: "Click on the image",
        maxClicks: 1,
      };
    case "ATTACHMENT":
      return {
        allowedKinds: ["image", "video", "document"],
        maxSizeMb: 25,
      };
    case "NPS":
      return {
        firmName: "our firm",
        followUpPrompt: DEFAULT_NPS_FOLLOW_UP_PROMPT,
        promoterRedirectUrl: "",
        contactFields: ["name", "email", "company"],
        closingTitle: DEFAULT_NPS_CLOSING_TITLE,
        closingBody: DEFAULT_NPS_CLOSING_BODY,
        closingLinks: [],
        closingLogoUrl: "",
      };
    case "CONTACT_INFO":
      return { companyMode: "free", companies: [] };
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

  const themeId = input.themeId?.trim() || DEFAULT_THEME_ID;
  if (!COMPANY_THEME_IDS.includes(themeId)) {
    errors.themeId = "Select a valid company theme.";
  }

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    errors.questions = "Add at least one question.";
    return errors;
  }

  if (input.anonymous && input.questions.some((question) => question.type === "CONTACT_INFO")) {
    errors.questions =
      "Anonymous surveys cannot include contact information questions.";
  }

  const indexById = new Map<string, number>();
  input.questions.forEach((question, index) => {
    if (question.id) {
      indexById.set(question.id, index);
    }
  });

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

    const visibilityError = validateQuestionVisibility(
      question.visibility,
      index,
      input.questions,
      indexById,
    );
    if (visibilityError) {
      errors[`${prefix}.visibility`] = visibilityError;
    }
  });

  return errors;
}

function validateQuestionVisibility(
  visibility: QuestionVisibility | null | undefined,
  index: number,
  questions: FormInput["questions"],
  indexById: Map<string, number>,
): string | null {
  if (!visibility) {
    return null;
  }

  if (visibility.match !== "all" && visibility.match !== "any") {
    return "Invalid branching match mode.";
  }

  if (!Array.isArray(visibility.conditions) || visibility.conditions.length === 0) {
    return null;
  }

  for (const condition of visibility.conditions) {
    if (!condition.questionId) {
      return "Choose a question for each branching rule.";
    }

    const targetIndex = indexById.get(condition.questionId);
    if (targetIndex === undefined) {
      return "Branching rules must reference a question in this survey.";
    }
    if (targetIndex >= index) {
      return "Branching rules can only depend on earlier questions.";
    }

    if (!isBranchOperator(condition.operator)) {
      return "Invalid branching condition.";
    }

    const targetType = questions[targetIndex].type;
    if (!operatorsForType(targetType).includes(condition.operator)) {
      return "That condition can't be used with the selected question.";
    }

    if (operatorRequiresValue(condition.operator)) {
      if (
        condition.value === undefined ||
        condition.value === null ||
        (typeof condition.value === "string" && condition.value.trim() === "")
      ) {
        return "Enter a value for each branching rule.";
      }
    }
  }

  return null;
}

function validateQuestionOptions(
  type: QuestionType,
  options: QuestionOptions,
): string | null {
  if (!isQuestionTypeValue(type)) {
    return "Unsupported question type.";
  }

  switch (type as QuestionTypeValue) {
    case "SCALE": {
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
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE": {
      const choice = options as SingleChoiceOptions | MultipleChoiceOptions;
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
      if (type === "MULTIPLE_CHOICE") {
        const multi = options as MultipleChoiceOptions;
        const min = multi.minSelections ?? 1;
        const max = multi.maxSelections ?? choice.choices.length;
        if (!Number.isInteger(min) || min < 1) {
          return "Minimum selections must be at least 1.";
        }
        if (!Number.isInteger(max) || max < min) {
          return "Maximum selections must be at least the minimum.";
        }
        if (max > choice.choices.length) {
          return "Maximum selections cannot exceed the number of choices.";
        }
      }
      return null;
    }
    case "SHORT_TEXT": {
      const text = options as ShortTextOptions;
      if (
        text.maxLength !== undefined &&
        (!Number.isInteger(text.maxLength) || text.maxLength < 1)
      ) {
        return "Max length must be a positive number.";
      }
      return null;
    }
    case "SLIDER": {
      const slider = options as SliderOptions;
      if (typeof slider.min !== "number" || typeof slider.max !== "number") {
        return "Slider min and max are required.";
      }
      if (slider.min >= slider.max) {
        return "Slider max must be greater than min.";
      }
      if (
        slider.step !== undefined &&
        (typeof slider.step !== "number" || slider.step <= 0)
      ) {
        return "Slider step must be a positive number.";
      }
      return null;
    }
    case "HEATMAP": {
      const heatmap = options as HeatmapOptions;
      if (!heatmap.imageUrl?.trim()) {
        return "Heatmap image URL is required.";
      }
      try {
        new URL(heatmap.imageUrl.trim());
      } catch {
        return "Heatmap image URL must be a valid URL.";
      }
      if (
        heatmap.maxClicks !== undefined &&
        (!Number.isInteger(heatmap.maxClicks) || heatmap.maxClicks < 1)
      ) {
        return "Max clicks must be a positive whole number.";
      }
      return null;
    }
    case "ATTACHMENT": {
      const attachment = options as AttachmentOptions;
      if (
        attachment.allowedKinds !== undefined &&
        (!Array.isArray(attachment.allowedKinds) ||
          attachment.allowedKinds.length === 0 ||
          attachment.allowedKinds.some(
            (kind) =>
              kind !== "image" && kind !== "video" && kind !== "document",
          ))
      ) {
        return "Choose at least one allowed attachment type.";
      }
      if (
        attachment.maxSizeMb !== undefined &&
        (!Number.isInteger(attachment.maxSizeMb) || attachment.maxSizeMb < 1)
      ) {
        return "Max attachment size must be a positive whole number.";
      }
      return null;
    }
    case "NPS": {
      const nps = options as NpsOptions;
      if (!nps.firmName?.trim()) {
        return "Firm name is required for NPS questions.";
      }
      if (nps.promoterRedirectUrl?.trim()) {
        try {
          new URL(nps.promoterRedirectUrl.trim());
        } catch {
          return "Promoter redirect URL must be a valid URL.";
        }
      }
      if (nps.closingLogoUrl?.trim()) {
        try {
          new URL(nps.closingLogoUrl.trim());
        } catch {
          return "Closing logo URL must be a valid URL.";
        }
      }
      if (
        nps.contactFields !== undefined &&
        (!Array.isArray(nps.contactFields) ||
          nps.contactFields.length === 0 ||
          nps.contactFields.some(
            (field) =>
              field !== "name" &&
              field !== "email" &&
              field !== "company" &&
              field !== "title",
          ))
      ) {
        return "Choose at least one contact field for promoters.";
      }
      if (nps.closingLinks) {
        for (const link of nps.closingLinks) {
          if (!link.label?.trim() || !link.url?.trim()) {
            return "Each closing link needs a label and URL.";
          }
          try {
            new URL(link.url.trim());
          } catch {
            return "Closing link URLs must be valid.";
          }
        }
      }
      return null;
    }
    case "CONTACT_INFO": {
      const contactInfo = options as ContactInfoOptions;
      if (contactInfo.companyMode === "dropdown") {
        if (!Array.isArray(contactInfo.companies) || contactInfo.companies.length === 0) {
          return "Add at least one company for the dropdown.";
        }
        if (contactInfo.companies.some((c) => typeof c !== "string" || !c.trim())) {
          return "Each company name must be a non-empty string.";
        }
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
    themeId: input.themeId?.trim() || DEFAULT_THEME_ID,
    anonymous: Boolean(input.anonymous),
    questions: input.questions.map((question, index) => ({
      ...(question.id ? { id: question.id } : {}),
      order: index + 1,
      type: question.type,
      prompt: question.prompt.trim(),
      required: question.required,
      options: normalizeQuestionOptions(question.type, question.options),
      visibility: normalizeQuestionVisibility(question.visibility),
    })),
  };
}

function normalizeQuestionVisibility(
  visibility: QuestionVisibility | null | undefined,
): QuestionVisibility | null {
  if (!visibility || !Array.isArray(visibility.conditions)) {
    return null;
  }

  const conditions: BranchCondition[] = visibility.conditions
    .filter((condition) => condition && condition.questionId && condition.operator)
    .map((condition) => {
      const normalized: BranchCondition = {
        questionId: condition.questionId,
        operator: condition.operator,
      };
      if (operatorRequiresValue(condition.operator) && condition.value !== undefined) {
        normalized.value =
          typeof condition.value === "string"
            ? condition.value.trim()
            : condition.value;
      }
      return normalized;
    });

  if (conditions.length === 0) {
    return null;
  }

  return {
    match: visibility.match === "any" ? "any" : "all",
    conditions,
  };
}

export const normalizeCreateFormInput = normalizeFormInput;

function normalizeQuestionOptions(
  type: QuestionType,
  options: QuestionOptions,
): QuestionOptions {
  if (!isQuestionTypeValue(type)) {
    return options;
  }

  switch (type as QuestionTypeValue) {
    case "SCALE": {
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
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE": {
      const choice = options as SingleChoiceOptions | MultipleChoiceOptions;
      const normalized: MultipleChoiceOptions | SingleChoiceOptions = {
        choices: choice.choices.map((item) => ({
          value: item.value.trim(),
          label: item.label.trim(),
        })),
      };
      if (type === "MULTIPLE_CHOICE") {
        const multi = options as MultipleChoiceOptions;
        return {
          ...normalized,
          ...(multi.minSelections ? { minSelections: multi.minSelections } : {}),
          ...(multi.maxSelections ? { maxSelections: multi.maxSelections } : {}),
        };
      }
      return normalized;
    }
    case "SHORT_TEXT": {
      const text = options as ShortTextOptions;
      return {
        ...(text.placeholder?.trim()
          ? { placeholder: text.placeholder.trim() }
          : {}),
        ...(text.maxLength ? { maxLength: text.maxLength } : {}),
      };
    }
    case "SLIDER": {
      const slider = options as SliderOptions;
      return {
        min: slider.min,
        max: slider.max,
        step: slider.step ?? 1,
        ...(slider.minLabel?.trim()
          ? { minLabel: slider.minLabel.trim() }
          : {}),
        ...(slider.maxLabel?.trim()
          ? { maxLabel: slider.maxLabel.trim() }
          : {}),
      };
    }
    case "HEATMAP": {
      const heatmap = options as HeatmapOptions;
      return {
        imageUrl: heatmap.imageUrl.trim(),
        ...(heatmap.alt?.trim() ? { alt: heatmap.alt.trim() } : {}),
        maxClicks: heatmap.maxClicks ?? 1,
      };
    }
    case "ATTACHMENT": {
      const attachment = options as AttachmentOptions;
      return {
        allowedKinds:
          attachment.allowedKinds?.filter(
            (kind) => kind === "image" || kind === "video" || kind === "document",
          ) ?? ["image", "video", "document"],
        maxSizeMb: Math.max(1, Math.round(attachment.maxSizeMb ?? 25)),
      };
    }
    case "NPS": {
      const nps = options as NpsOptions;
      const contactFields = (nps.contactFields ?? ["name", "email", "company"]).filter(
        (field): field is NpsContactField =>
          field === "name" ||
          field === "email" ||
          field === "company" ||
          field === "title",
      );
      const closingLinks = (nps.closingLinks ?? [])
        .map((link) => ({
          label: link.label.trim(),
          url: link.url.trim(),
        }))
        .filter((link) => link.label && link.url);

      return {
        firmName: nps.firmName.trim(),
        followUpPrompt: nps.followUpPrompt?.trim() || DEFAULT_NPS_FOLLOW_UP_PROMPT,
        promoterRedirectUrl: nps.promoterRedirectUrl?.trim() || "",
        contactFields: contactFields.length > 0 ? contactFields : ["name", "email"],
        closingTitle: nps.closingTitle?.trim() || DEFAULT_NPS_CLOSING_TITLE,
        closingBody: nps.closingBody?.trim() || DEFAULT_NPS_CLOSING_BODY,
        closingLinks,
        ...(nps.closingLogoUrl?.trim()
          ? { closingLogoUrl: nps.closingLogoUrl.trim() }
          : {}),
      };
    }
    case "CONTACT_INFO": {
      const contactInfo = options as ContactInfoOptions;
      return {
        companyMode: contactInfo.companyMode ?? "free",
        companies: contactInfo.companies ?? [],
      };
    }
    default:
      return options;
  }
}
