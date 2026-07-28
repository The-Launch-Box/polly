import { QuestionType } from "@/generated/prisma/enums";
import type {
  BranchCondition,
  BranchOperator,
  FormQuestion,
  QuestionVisibility,
} from "@/lib/types";
import { isNpsAnswer } from "@/lib/types";

export const BRANCH_OPERATOR_LABELS: Record<BranchOperator, string> = {
  equals: "is equal to",
  not_equals: "is not equal to",
  includes: "includes",
  not_includes: "does not include",
  greater_than: "is greater than",
  greater_than_or_equal: "is at least",
  less_than: "is less than",
  less_than_or_equal: "is at most",
  answered: "is answered",
  not_answered: "is not answered",
};

const NUMERIC_OPERATORS: BranchOperator[] = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
];

const PRESENCE_OPERATORS: BranchOperator[] = ["answered", "not_answered"];

/**
 * Operators a condition may use when it inspects a question of the given type.
 * These bound the builder UI so authors can only pick meaningful comparisons.
 */
export function operatorsForType(type: QuestionType): BranchOperator[] {
  switch (type) {
    case QuestionType.SINGLE_CHOICE:
      return ["equals", "not_equals", ...PRESENCE_OPERATORS];
    case QuestionType.MULTIPLE_CHOICE:
      return ["includes", "not_includes", ...PRESENCE_OPERATORS];
    case QuestionType.SCALE:
    case QuestionType.SLIDER:
    case QuestionType.NPS:
      return [...NUMERIC_OPERATORS, ...PRESENCE_OPERATORS];
    case QuestionType.SHORT_TEXT:
      return ["equals", "not_equals", ...PRESENCE_OPERATORS];
    default:
      // HEATMAP, ATTACHMENT, CONTACT_INFO: only presence checks make sense.
      return [...PRESENCE_OPERATORS];
  }
}

export function operatorRequiresValue(operator: BranchOperator): boolean {
  return !PRESENCE_OPERATORS.includes(operator);
}

/** Whether the comparison value should be picked from the target question's choices. */
export function operatorUsesChoiceValue(type: QuestionType): boolean {
  return (
    type === QuestionType.SINGLE_CHOICE || type === QuestionType.MULTIPLE_CHOICE
  );
}

function isEmptyAnswer(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  return false;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (isNpsAnswer(value)) {
    return value.score;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : item && typeof item === "object" && "value" in item
            ? String((item as { value: unknown }).value)
            : null,
      )
      .filter((item): item is string => item !== null);
  }
  return [];
}

function valuesEqual(answerValue: unknown, target: string | number): boolean {
  const answerNumber = toNumber(answerValue);
  if (answerNumber !== null) {
    const targetNumber = toNumber(target);
    if (targetNumber !== null) {
      return answerNumber === targetNumber;
    }
  }
  if (typeof answerValue === "string") {
    return answerValue.trim() === String(target).trim();
  }
  return false;
}

/** Evaluate a single condition against the raw answer stored for its target question. */
export function isConditionMet(
  condition: BranchCondition,
  answerValue: unknown,
): boolean {
  const empty = isEmptyAnswer(answerValue);

  if (condition.operator === "answered") {
    return !empty;
  }
  if (condition.operator === "not_answered") {
    return empty;
  }

  // Any comparison against an unanswered question fails, so dependent
  // questions only surface once their trigger has actually been answered.
  if (empty) {
    return false;
  }

  const target = condition.value;

  switch (condition.operator) {
    case "equals":
      return target !== undefined && valuesEqual(answerValue, target);
    case "not_equals":
      return target !== undefined && !valuesEqual(answerValue, target);
    case "includes":
      return (
        target !== undefined &&
        toStringList(answerValue).includes(String(target))
      );
    case "not_includes":
      return (
        target !== undefined &&
        !toStringList(answerValue).includes(String(target))
      );
    case "greater_than":
    case "greater_than_or_equal":
    case "less_than":
    case "less_than_or_equal": {
      const answerNumber = toNumber(answerValue);
      const targetNumber = target === undefined ? null : toNumber(target);
      if (answerNumber === null || targetNumber === null) {
        return false;
      }
      if (condition.operator === "greater_than") return answerNumber > targetNumber;
      if (condition.operator === "greater_than_or_equal") {
        return answerNumber >= targetNumber;
      }
      if (condition.operator === "less_than") return answerNumber < targetNumber;
      return answerNumber <= targetNumber;
    }
    default:
      return false;
  }
}

type VisibilityContext = {
  answers: Record<string, unknown>;
  // Ids of questions currently shown. A condition that points at a hidden
  // question is treated as unmet so branches never cascade off dead paths.
  visibleIds: Set<string>;
};

function evaluateVisibility(
  visibility: QuestionVisibility | null,
  context: VisibilityContext,
): boolean {
  if (!visibility || visibility.conditions.length === 0) {
    return true;
  }

  const results = visibility.conditions.map((condition) => {
    if (!context.visibleIds.has(condition.questionId)) {
      // Target is hidden (or unknown): only "not answered" can hold.
      return condition.operator === "not_answered";
    }
    return isConditionMet(condition, context.answers[condition.questionId]);
  });

  return visibility.match === "any"
    ? results.some(Boolean)
    : results.every(Boolean);
}

/**
 * Given questions in order and the answers collected so far, returns the ids of
 * questions that should be shown. Evaluated in order so a condition can only
 * depend on questions that precede (and are themselves visible).
 */
export function getVisibleQuestionIds(
  questions: FormQuestion[],
  answers: Record<string, unknown>,
): Set<string> {
  const visibleIds = new Set<string>();
  for (const question of questions) {
    if (evaluateVisibility(question.visibility, { answers, visibleIds })) {
      visibleIds.add(question.id);
    }
  }
  return visibleIds;
}

export function getVisibleQuestions(
  questions: FormQuestion[],
  answers: Record<string, unknown>,
): FormQuestion[] {
  const visibleIds = getVisibleQuestionIds(questions, answers);
  return questions.filter((question) => visibleIds.has(question.id));
}
