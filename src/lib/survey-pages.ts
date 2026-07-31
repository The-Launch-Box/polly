import type { FormQuestion } from "@/lib/types";
import { isHeatmapPoint, isPointAllocationAnswer, pointAllocationTotal } from "@/lib/types";
import { isNonInputQuestionType, isSectionType } from "@/lib/question-types";

/** One navigable screen in the survey player. */
export type SurveyPage =
  | { kind: "single"; questionIndex: number }
  | {
      kind: "section-body";
      sectionIndex: number;
      questionIndices: number[];
    };

/**
 * Build player pages from the flat question list.
 * Each SECTION becomes one scrollable page of its children (questions until the
 * next SECTION), with the section title shown on that page. Ungrouped questions
 * stay one-per-screen.
 */
export function buildSurveyPages(questions: FormQuestion[]): SurveyPage[] {
  const pages: SurveyPage[] = [];
  let i = 0;

  while (i < questions.length) {
    const question = questions[i];
    if (isSectionType(question.type)) {
      const sectionIndex = i;
      i += 1;

      const questionIndices: number[] = [];
      while (i < questions.length && !isSectionType(questions[i].type)) {
        questionIndices.push(i);
        i += 1;
      }

      if (questionIndices.length > 0) {
        pages.push({ kind: "section-body", sectionIndex, questionIndices });
      }
      continue;
    }

    pages.push({ kind: "single", questionIndex: i });
    i += 1;
  }

  return pages;
}

/** Pages (and section-body children) still reachable given current visibility. */
export function filterVisibleSurveyPages(
  pages: SurveyPage[],
  questions: FormQuestion[],
  visibleIds: Set<string>,
): SurveyPage[] {
  const result: SurveyPage[] = [];

  for (const page of pages) {
    if (page.kind === "single") {
      if (visibleIds.has(questions[page.questionIndex].id)) {
        result.push(page);
      }
      continue;
    }

    if (!visibleIds.has(questions[page.sectionIndex].id)) {
      continue;
    }

    const visibleChildren = page.questionIndices.filter((index) =>
      visibleIds.has(questions[index].id),
    );
    if (visibleChildren.length > 0) {
      result.push({ ...page, questionIndices: visibleChildren });
    }
  }

  return result;
}

/** Discrete answer types that auto-scroll to the next question when answered. */
export function shouldAutoAdvanceOnAnswer(type: string): boolean {
  return (
    type === "SCALE" ||
    type === "SINGLE_CHOICE" ||
    type === "SLIDER" ||
    type === "HEATMAP" ||
    type === "ATTACHMENT"
  );
}

/** Whether a question currently has a usable answer value (not full validation). */
export function hasAnswerValue(
  question: FormQuestion,
  value: unknown,
): boolean {
  if (isNonInputQuestionType(question.type) || question.type === "NPS") {
    return false;
  }

  if (question.type === "POINT_ALLOCATION") {
    if (!isPointAllocationAnswer(value)) return false;
    return pointAllocationTotal(value) > 0;
  }

  if (value === undefined || value === null || value === "") {
    return false;
  }
  if (typeof value === "string" && !value.trim()) {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  if (question.type === "ATTACHMENT" && !(value instanceof File)) {
    return false;
  }
  if (question.type === "HEATMAP") {
    if (isHeatmapPoint(value)) return true;
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(isHeatmapPoint)
    );
  }
  if (question.type === "MULTIPLE_CHOICE" && Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

export function pageKey(page: SurveyPage): string {
  if (page.kind === "single") {
    return `single:${page.questionIndex}`;
  }
  return `section-body:${page.sectionIndex}`;
}
