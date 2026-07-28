import * as XLSX from "xlsx";
import { QuestionType } from "@/generated/prisma/enums";
import { rowsToCsv } from "@/lib/csv";
import {
  buildSurveyInsights,
  formatDuration,
  type SurveyInsights,
} from "@/lib/survey-insights";
import type { QuestionOptions } from "@/lib/types";

type ExportForm = {
  id: string;
  slug: string;
  title: string;
  questions: Array<{
    id: string;
    order: number;
    type: QuestionType;
    prompt: string;
    options: QuestionOptions | null;
  }>;
};

type ExportSubmission = {
  id: string;
  submittedAt: Date;
  totalDurationMs: number | null;
  answers: Array<{
    questionId: string;
    value: unknown;
    durationMs: number | null;
  }>;
};

export function buildSurveyInsightsForExport(
  form: ExportForm,
  submissions: ExportSubmission[],
): SurveyInsights {
  return buildSurveyInsights(form, submissions);
}

function questionHeaders(insights: SurveyInsights): string[] {
  return insights.questions.map(
    (question) => `Q${question.order}: ${question.prompt}`,
  );
}

function durationMsToSeconds(ms: number | null | undefined): number | null {
  if (ms == null || ms < 0) return null;
  return Math.round((ms / 1000) * 1000) / 1000;
}

function buildResponsesSheet(
  insights: SurveyInsights,
): Array<Array<string | number | null>> {
  const headers = questionHeaders(insights);
  const rows: Array<Array<string | number | null>> = [headers];

  for (const submission of insights.submissions) {
    const byQuestionId = new Map(
      submission.answers.map((answer) => [answer.questionId, answer.valueLabel]),
    );
    rows.push(
      insights.questions.map(
        (question) => byQuestionId.get(question.questionId) ?? "",
      ),
    );
  }

  return rows;
}

function buildMetadataSheet(
  insights: SurveyInsights,
): Array<Array<string | number | null>> {
  return [
    ["Metric", "Value"],
    ["Responses", insights.responseCount],
    ["Avg. completion time", formatDuration(insights.avgTotalDurationMs)],
    ["Number of questions", insights.questions.length],
  ];
}

function buildTimeSheet(
  insights: SurveyInsights,
): Array<Array<string | number | null>> {
  const headers = questionHeaders(insights);
  const rows: Array<Array<string | number | null>> = [headers];

  for (const submission of insights.submissions) {
    const byQuestionId = new Map(
      submission.answers.map((answer) => [answer.questionId, answer.durationMs]),
    );
    rows.push(
      insights.questions.map((question) => {
        const seconds = durationMsToSeconds(
          byQuestionId.get(question.questionId),
        );
        return seconds ?? "";
      }),
    );
  }

  return rows;
}

/**
 * Long-format CSV: one row per answer.
 * Columns: question (number), time (seconds), response (answer value).
 * No metadata / summary rows.
 */
export function buildSurveyExportCsv(insights: SurveyInsights): string {
  const rows: Array<Array<string | number | null | undefined>> = [
    ["question", "time", "response"],
  ];

  for (const submission of insights.submissions) {
    const byQuestionId = new Map(
      submission.answers.map((answer) => [
        answer.questionId,
        { valueLabel: answer.valueLabel, durationMs: answer.durationMs },
      ]),
    );

    for (const question of insights.questions) {
      const answer = byQuestionId.get(question.questionId);
      rows.push([
        question.order,
        durationMsToSeconds(answer?.durationMs) ?? "",
        answer?.valueLabel ?? "",
      ]);
    }
  }

  return rowsToCsv(rows);
}

/** Multi-sheet .xlsx workbook (responses / metadata / time). */
export function buildSurveyExportWorkbook(insights: SurveyInsights): Buffer {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(buildResponsesSheet(insights)),
    "responses",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(buildMetadataSheet(insights)),
    "metadata",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(buildTimeSheet(insights)),
    "time",
  );

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}
