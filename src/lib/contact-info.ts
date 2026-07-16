import type { ContactInfoAnswer } from "@/lib/types";

export const DEFAULT_CONTACT_INFO_PROMPT = "Please share your contact information.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyContactInfoAnswer(): ContactInfoAnswer {
  return {
    firstName: "",
    lastName: "",
    email: "",
    businessName: "",
  };
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

export function isContactInfoComplete(value: unknown): boolean {
  if (!isContactInfoAnswer(value)) {
    return false;
  }

  return (
    value.firstName.trim().length > 0 &&
    value.lastName.trim().length > 0 &&
    value.email.trim().length > 0 &&
    value.businessName.trim().length > 0
  );
}

export function validateContactInfoAnswer(
  value: unknown,
  required: boolean,
  anonymous = false,
): string | null {
  if (anonymous) {
    return "Contact information cannot be collected on anonymous surveys.";
  }

  if (!isContactInfoAnswer(value)) {
    return required ? "Please complete all contact fields." : null;
  }

  const firstName = value.firstName.trim();
  const lastName = value.lastName.trim();
  const email = value.email.trim();
  const businessName = value.businessName.trim();

  if (!required) {
    const anyFilled = firstName || lastName || email || businessName;
    if (!anyFilled) {
      return null;
    }
  }

  if (!firstName) {
    return "First name is required.";
  }
  if (!lastName) {
    return "Last name is required.";
  }
  if (!email) {
    return "Company email is required.";
  }
  if (!EMAIL_PATTERN.test(email)) {
    return "Enter a valid company email address.";
  }
  if (!businessName) {
    return "Business name is required.";
  }

  return null;
}

export function normalizeContactInfoAnswer(value: ContactInfoAnswer): ContactInfoAnswer {
  return {
    firstName: value.firstName.trim(),
    lastName: value.lastName.trim(),
    email: value.email.trim(),
    businessName: value.businessName.trim(),
  };
}
