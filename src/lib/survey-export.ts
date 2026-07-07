import { QuestionType } from "@prisma/client";
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

function buildResponsesSection(
  surveyId: string,
  insights: SurveyInsights,
): string {
  const questionHeaders = insights.questions.map(
    (question) => `Q${question.order}: ${question.prompt}`,
  );

  const header = [
    "Survey ID",
    "Submission ID",
    "Submitted At",
    "Total Duration",
    ...questionHeaders,
  ];

  const rows: Array<Array<string | number | null | undefined>> = [header];

  for (const submission of insights.submissions) {
    rows.push([
      surveyId,
      submission.id,
      submission.submittedAt instanceof Date
        ? submission.submittedAt.toISOString()
        : submission.submittedAt,
      formatDuration(submission.totalDurationMs),
      ...submission.answers.map((answer) => answer.valueLabel),
    ]);
  }

  return rowsToCsv(rows);
}

function buildAggregatesSection(insights: SurveyInsights): string {
  const rows: Array<Array<string | number | null | undefined>> = [];

  rows.push(["Summary"]);
  rows.push(["Metric", "Value"]);
  rows.push(["Survey", insights.formTitle]);
  rows.push(["Slug", insights.formSlug]);
  rows.push(["Responses", insights.responseCount]);
  rows.push(["Avg completion time", formatDuration(insights.avgTotalDurationMs)]);
  rows.push(["Questions", insights.questions.length]);
  rows.push([]);

  rows.push(["Responses by day"]);
  rows.push(["Date", "Count"]);
  for (const entry of insights.responseTimeline) {
    rows.push([entry.date, entry.count]);
  }
  rows.push([]);

  rows.push(["Time per question (seconds)"]);
  rows.push(["Question", "Average", "Min", "Max"]);
  for (const entry of insights.questionTimingChart) {
    rows.push([
      entry.question,
      entry.avgSeconds,
      entry.minSeconds,
      entry.maxSeconds,
    ]);
  }
  rows.push([]);

  rows.push(["Per-question summary"]);
  rows.push([
    "Question",
    "Prompt",
    "Type",
    "Summary",
    "Responses timed",
    "Avg time",
    "Min time",
    "Max time",
  ]);
  for (const question of insights.questions) {
    rows.push([
      `Q${question.order}`,
      question.prompt,
      question.type,
      question.summary,
      question.timing?.count ?? 0,
      question.timing ? formatDuration(question.timing.avgMs) : "—",
      question.timing ? formatDuration(question.timing.minMs) : "—",
      question.timing ? formatDuration(question.timing.maxMs) : "—",
    ]);
  }
  rows.push([]);

  const choiceQuestions = insights.questions.filter(
    (question) => question.choiceBuckets && question.choiceBuckets.length > 0,
  );
  if (choiceQuestions.length > 0) {
    rows.push(["Choice distributions"]);
    rows.push(["Question", "Option", "Count", "Percentage"]);
    for (const question of choiceQuestions) {
      const total = question.choiceBuckets!.reduce((sum, bucket) => sum + bucket.count, 0);
      for (const bucket of question.choiceBuckets!) {
        const percentage =
          total > 0 ? `${((bucket.count / total) * 100).toFixed(1)}%` : "0%";
        rows.push([
          `Q${question.order}: ${question.prompt}`,
          bucket.label,
          bucket.count,
          percentage,
        ]);
      }
    }
    rows.push([]);
  }

  const numericQuestions = insights.questions.filter(
    (question) => question.numericDistribution && question.numericDistribution.length > 0,
  );
  if (numericQuestions.length > 0) {
    rows.push(["Numeric distributions"]);
    rows.push(["Question", "Value", "Count"]);
    for (const question of numericQuestions) {
      for (const bucket of question.numericDistribution!) {
        rows.push([
          `Q${question.order}: ${question.prompt}`,
          bucket.label,
          bucket.count,
        ]);
      }
    }
    rows.push([]);
  }

  const textQuestions = insights.questions.filter(
    (question) => question.textResponses && question.textResponses.length > 0,
  );
  if (textQuestions.length > 0) {
    rows.push(["Text responses"]);
    rows.push(["Question", "Response", "Time on question"]);
    for (const question of textQuestions) {
      for (const response of question.textResponses!) {
        rows.push([
          `Q${question.order}: ${question.prompt}`,
          response.value,
          formatDuration(response.durationMs),
        ]);
      }
    }
  }

  return rowsToCsv(rows);
}

export function buildSurveyExportCsv(
  surveyId: string,
  insights: SurveyInsights,
): string {
  const responses = buildResponsesSection(surveyId, insights);
  const aggregates = buildAggregatesSection(insights);

  return [
    "Page 1 - Responses",
    responses,
    "",
    "Page 2 - Aggregates",
    aggregates,
  ].join("\r\n");
}
