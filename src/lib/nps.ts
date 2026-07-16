import type { NpsAnswer, NpsContactField, NpsOptions } from "@/lib/types";

export const NPS_MIN_SCORE = 0;
export const NPS_MAX_SCORE = 10;
export const NPS_PROMOTER_SCORE = 10;

export const NPS_CONTACT_FIELD_LABELS: Record<NpsContactField, string> = {
  name: "Full name",
  email: "Email address",
  company: "Company",
  title: "Job title",
};

export const DEFAULT_NPS_FOLLOW_UP_PROMPT =
  "Is there anything we could have done differently to get a 10?";

export const DEFAULT_NPS_CLOSING_TITLE = "Thanks for the feedback!";
export const DEFAULT_NPS_CLOSING_BODY =
  "Follow us on LinkedIn or subscribe to our newsletter.";

export function getDefaultNpsPrompt(firmName: string): string {
  const trimmed = firmName.trim() || "our firm";
  return `On a scale of 0 to 10, how likely is it that you would recommend ${trimmed} to a partner or colleague?`;
}

export function getNpsPrompt(prompt: string, options: NpsOptions): string {
  const trimmed = prompt.trim();
  if (trimmed) {
    return trimmed;
  }

  return getDefaultNpsPrompt(options.firmName);
}

export function getNpsFollowUpPrompt(options: NpsOptions): string {
  return options.followUpPrompt?.trim() || DEFAULT_NPS_FOLLOW_UP_PROMPT;
}

export function getNpsContactFields(options: NpsOptions): NpsContactField[] {
  const fields = options.contactFields?.filter(
    (field): field is NpsContactField =>
      field === "name" ||
      field === "email" ||
      field === "company" ||
      field === "title",
  );

  return fields && fields.length > 0 ? fields : ["name", "email"];
}

export function isPromoterScore(score: number): boolean {
  return score === NPS_PROMOTER_SCORE;
}

export function getNpsPath(score: number): NpsAnswer["path"] {
  return isPromoterScore(score) ? "promoter" : "detractor";
}

export function buildNpsAnswer({
  score,
  followUpText,
  contact,
}: {
  score: number;
  followUpText?: string;
  contact?: NpsAnswer["contact"];
}): NpsAnswer {
  const path = getNpsPath(score);
  return {
    score,
    path,
    ...(path === "detractor" && followUpText?.trim()
      ? { followUpText: followUpText.trim() }
      : {}),
    ...(path === "promoter" && contact ? { contact } : {}),
  };
}

export function validateNpsContact(
  contact: Partial<Record<NpsContactField, string>>,
  fields: NpsContactField[],
): string | null {
  for (const field of fields) {
    const value = contact[field]?.trim() ?? "";
    if (!value) {
      return `${NPS_CONTACT_FIELD_LABELS[field]} is required.`;
    }

    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Enter a valid email address.";
    }
  }

  return null;
}

export function validateNpsAnswer(
  value: unknown,
  options: NpsOptions,
  required: boolean,
  anonymous = false,
): string | null {
  if (value === null || value === undefined) {
    return required ? "This question is required." : null;
  }

  if (typeof value !== "object") {
    return "Invalid NPS response.";
  }

  const answer = value as NpsAnswer;
  if (
    typeof answer.score !== "number" ||
    !Number.isInteger(answer.score) ||
    answer.score < NPS_MIN_SCORE ||
    answer.score > NPS_MAX_SCORE
  ) {
    return "NPS score must be a whole number from 0 to 10.";
  }

  const expectedPath = getNpsPath(answer.score);
  if (answer.path !== expectedPath) {
    return "Invalid NPS response path.";
  }

  if (expectedPath === "promoter" && !anonymous) {
    const contactError = validateNpsContact(
      answer.contact ?? {},
      getNpsContactFields(options),
    );
    if (contactError) {
      return contactError;
    }

    if (options.promoterRedirectUrl?.trim()) {
      try {
        new URL(options.promoterRedirectUrl.trim());
      } catch {
        return "Promoter redirect URL is misconfigured.";
      }
    }
  }

  if (expectedPath === "promoter" && anonymous && answer.contact) {
    return "Contact details cannot be submitted on anonymous surveys.";
  }

  return null;
}
