import { QuestionType } from "@/generated/prisma/enums";
import {
  formatAnswerValue,
  isChoiceListOptions,
  isScaleOptions,
  isSliderOptions,
  type QuestionOptions,
} from "@/lib/types";

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) {
    return "—";
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export type TimingStats = {
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
};

export function computeTimingStats(
  durations: Array<number | null | undefined>,
): TimingStats | null {
  const valid = durations.filter(
    (duration): duration is number =>
      typeof duration === "number" && duration >= 0,
  );
  if (valid.length === 0) {
    return null;
  }
  return {
    count: valid.length,
    avgMs: valid.reduce((sum, value) => sum + value, 0) / valid.length,
    minMs: Math.min(...valid),
    maxMs: Math.max(...valid),
  };
}

type QuestionRecord = {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  options: QuestionOptions | null;
};

type AnswerRecord = {
  questionId: string;
  value: unknown;
  durationMs: number | null;
};

type SubmissionRecord = {
  id: string;
  submittedAt: Date;
  totalDurationMs: number | null;
  answers: AnswerRecord[];
};

export type ChoiceBucket = {
  label: string;
  value: string;
  count: number;
};

export type NumericBucket = {
  label: string;
  value: number;
  count: number;
};

export type QuestionInsight = {
  questionId: string;
  order: number;
  type: QuestionType;
  prompt: string;
  timing: TimingStats | null;
  summary: string;
  choiceBuckets?: ChoiceBucket[];
  numericAvg?: number;
  numericDistribution?: NumericBucket[];
  textResponses?: Array<{ value: string; durationMs: number | null }>;
};

export type SubmissionInsight = {
  id: string;
  submittedAt: Date | string;
  totalDurationMs: number | null;
  answers: Array<{
    questionId: string;
    order: number;
    prompt: string;
    valueLabel: string;
    durationMs: number | null;
  }>;
};

export type SurveyInsights = {
  formSlug: string;
  formTitle: string;
  responseCount: number;
  avgTotalDurationMs: number | null;
  questions: QuestionInsight[];
  submissions: SubmissionInsight[];
  /** Avg seconds per question — for overview bar chart */
  questionTimingChart: Array<{
    order: number;
    question: string;
    avgSeconds: number;
    minSeconds: number;
    maxSeconds: number;
  }>;
  /** Submissions grouped by calendar day */
  responseTimeline: Array<{ date: string; count: number }>;
  /** Recent submission completion times in seconds */
  completionTimes: Array<{ label: string; seconds: number }>;
};

function summarizeQuestion(
  question: QuestionRecord,
  answers: AnswerRecord[],
): Pick<QuestionInsight, "summary" | "choiceBuckets" | "numericAvg" | "numericDistribution" | "textResponses"> {
  const values = answers.map((answer) => answer.value);

  if (
    question.type === QuestionType.SINGLE_CHOICE ||
    question.type === QuestionType.MULTIPLE_CHOICE
  ) {
    const options = question.options;
    if (!isChoiceListOptions(options)) {
      return { summary: `${answers.length} response(s)` };
    }

    const counts = new Map<string, number>();
    for (const choice of options.choices) {
      counts.set(choice.value, 0);
    }

    for (const value of values) {
      if (question.type === QuestionType.SINGLE_CHOICE && typeof value === "string") {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      if (question.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(value)) {
        for (const selected of value) {
          if (typeof selected === "string") {
            counts.set(selected, (counts.get(selected) ?? 0) + 1);
          } else if (
            typeof selected === "object" &&
            selected !== null &&
            "value" in selected
          ) {
            const key = String((selected as { value: string }).value);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
      }
      if (
        typeof value === "object" &&
        value !== null &&
        "value" in value &&
        question.type === QuestionType.SINGLE_CHOICE
      ) {
        const key = String((value as { value: string }).value);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const choiceBuckets = options.choices.map((choice) => ({
      label: choice.label,
      value: choice.value,
      count: counts.get(choice.value) ?? 0,
    }));

    const top = [...choiceBuckets].sort((a, b) => b.count - a.count)[0];
    const summary = top
      ? `Most selected: ${top.label} (${top.count})`
      : `${answers.length} response(s)`;

    return { summary, choiceBuckets };
  }

  if (question.type === QuestionType.SCALE || question.type === QuestionType.SLIDER) {
    const numbers = values.filter(
      (value): value is number => typeof value === "number" && !Number.isNaN(value),
    );
    if (numbers.length === 0) {
      return { summary: "No numeric responses yet" };
    }
    const avg = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;

    let min = Math.min(...numbers);
    let max = Math.max(...numbers);
    if (question.type === QuestionType.SCALE && isScaleOptions(question.options)) {
      min = question.options.min;
      max = question.options.max;
    }
    if (question.type === QuestionType.SLIDER && isSliderOptions(question.options)) {
      min = question.options.min;
      max = question.options.max;
    }

    const counts = new Map<number, number>();
    for (let value = min; value <= max; value += 1) {
      counts.set(value, 0);
    }
    for (const number of numbers) {
      const rounded = Math.round(number);
      counts.set(rounded, (counts.get(rounded) ?? 0) + 1);
    }

    const numericDistribution = [...counts.entries()].map(([value, count]) => ({
      value,
      label: String(value),
      count,
    }));

    return {
      summary: `Average: ${avg.toFixed(1)}`,
      numericAvg: avg,
      numericDistribution,
    };
  }

  if (question.type === QuestionType.SHORT_TEXT) {
    const textResponses = answers
      .map((answer) => ({
        value: formatAnswerValue(answer.value),
        durationMs: answer.durationMs,
      }))
      .filter((item) => item.value !== "—");

    return {
      summary: `${textResponses.length} text response(s)`,
      textResponses,
    };
  }

  if (question.type === QuestionType.HEATMAP) {
    return { summary: `${answers.length} heatmap response(s)` };
  }

  if (question.type === QuestionType.ATTACHMENT) {
    return { summary: `${answers.length} attachment response(s)` };
  }

  if (question.type === QuestionType.NPS) {
    const scores = answers
      .map((answer) =>
        typeof answer.value === "object" &&
        answer.value !== null &&
        "score" in answer.value
          ? Number((answer.value as { score: number }).score)
          : null,
      )
      .filter((score): score is number => score !== null && !Number.isNaN(score));

    if (scores.length === 0) {
      return { summary: "No NPS scores yet" };
    }

    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const promoters = scores.filter((score) => score === 10).length;
    const detractors = scores.filter((score) => score <= 9).length;

    const counts = new Map<number, number>();
    for (const score of scores) {
      counts.set(score, (counts.get(score) ?? 0) + 1);
    }
    const numericDistribution = [...counts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([value, count]) => ({
        value,
        label: String(value),
        count,
      }));

    return {
      summary: `Average: ${avg.toFixed(1)} · Promoters: ${promoters} · Follow-ups: ${detractors}`,
      numericAvg: avg,
      numericDistribution,
    };
  }

  if (question.type === QuestionType.CONTACT_INFO) {
    return { summary: `${answers.length} contact response(s)` };
  }

  return { summary: `${answers.length} response(s)` };
}

export function buildSurveyInsights(
  form: {
    slug: string;
    title: string;
    questions: QuestionRecord[];
  },
  submissions: SubmissionRecord[],
): SurveyInsights {
  const questions = form.questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((question) => {
      const questionAnswers = submissions.flatMap((submission) =>
        submission.answers
          .filter((answer) => answer.questionId === question.id)
          .map((answer) => ({
            questionId: question.id,
            value: answer.value,
            durationMs: answer.durationMs,
          })),
      );

      const timing = computeTimingStats(
        questionAnswers.map((answer) => answer.durationMs),
      );

      const summaryParts = summarizeQuestion(question, questionAnswers);

      return {
        questionId: question.id,
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        timing,
        ...summaryParts,
      };
    });

  const submissionInsights: SubmissionInsight[] = submissions.map((submission) => ({
    id: submission.id,
    submittedAt: submission.submittedAt,
    totalDurationMs: submission.totalDurationMs,
    answers: form.questions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((question) => {
        const answer = submission.answers.find(
          (item) => item.questionId === question.id,
        );
        return {
          questionId: question.id,
          order: question.order,
          prompt: question.prompt,
          valueLabel: answer ? formatAnswerValue(answer.value) : "—",
          durationMs: answer?.durationMs ?? null,
        };
      }),
  }));

  const totalDurations = submissions
    .map((submission) => submission.totalDurationMs)
    .filter((duration): duration is number => duration != null && duration >= 0);

  const questionTimingChart = questions
    .filter((question) => question.timing)
    .map((question) => ({
      order: question.order,
      question: `Q${question.order}`,
      avgSeconds: Math.round((question.timing!.avgMs / 1000) * 10) / 10,
      minSeconds: Math.round((question.timing!.minMs / 1000) * 10) / 10,
      maxSeconds: Math.round((question.timing!.maxMs / 1000) * 10) / 10,
    }));

  const dayCounts = new Map<string, number>();
  for (const submission of submissions) {
    const date = submission.submittedAt.toISOString().slice(0, 10);
    dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
  }
  const responseTimeline = [...dayCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const completionTimes = [...submissions]
    .reverse()
    .slice(0, 15)
    .map((submission, index) => ({
      label: `#${index + 1}`,
      seconds:
        submission.totalDurationMs != null
          ? Math.round(submission.totalDurationMs / 100) / 10
          : 0,
    }));

  return {
    formSlug: form.slug,
    formTitle: form.title,
    responseCount: submissions.length,
    avgTotalDurationMs:
      totalDurations.length > 0
        ? totalDurations.reduce((sum, value) => sum + value, 0) /
          totalDurations.length
        : null,
    questions,
    submissions: submissionInsights,
    questionTimingChart,
    responseTimeline,
    completionTimes,
  };
}

export function maxAvgQuestionTimeMs(questions: QuestionInsight[]): number {
  return questions.reduce((max, question) => {
    const avg = question.timing?.avgMs ?? 0;
    return avg > max ? avg : max;
  }, 0);
}
