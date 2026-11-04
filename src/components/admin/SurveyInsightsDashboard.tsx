"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDuration, type QuestionInsight, type SurveyInsights } from "@/lib/survey-insights";

const CHART_PALETTE = [
  "#FF6600",
  "#8b949e",
  "#58a6ff",
  "#f0f6fc",
  "#FF844D",
  "#6e7681",
  "#4ade80",
  "#fbbf24",
  "#FF3300",
  "#c9d1d9",
];

const TOOLTIP_STYLE = {
  background: "#161b22",
  color: "#f0f6fc",
  borderRadius: "8px",
  border: "1px solid #30363d",
  fontSize: "12px",
};

type SurveyInsightsDashboardProps = {
  insights: SurveyInsights;
  formSlug: string;
  canDeleteResponses?: boolean;
};

export function SurveyInsightsDashboard({
  insights,
  formSlug,
  canDeleteResponses = false,
}: SurveyInsightsDashboardProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (insights.responseCount === 0) {
    return null;
  }

  async function deleteSubmission(submissionId: string) {
    if (
      !window.confirm(
        "Delete this response permanently? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeleteError(null);
    setDeletingId(submissionId);
    try {
      const response = await fetch(
        `/api/admin/forms/${formSlug}/submissions/${submissionId}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setDeleteError(data?.error ?? "Could not delete response.");
        return;
      }
      router.refresh();
    } catch {
      setDeleteError("Could not delete response.");
    } finally {
      setDeletingId(null);
    }
  }

  const choicePieData = insights.questions
    .filter((question) => question.choiceBuckets && question.choiceBuckets.some((b) => b.count > 0))
    .length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Time per question"
          description="Average seconds spent on each screen"
        >
          {insights.questionTimingChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={insights.questionTimingChart}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="question" tick={{ fontSize: 12 }} stroke="#8b949e" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#8b949e"
                  unit="s"
                  width={36}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => {
                    const num = typeof value === "number" ? value : 0;
                    if (name === "avgSeconds") return [`${num}s`, "Average"];
                    if (name === "minSeconds") return [`${num}s`, "Min"];
                    if (name === "maxSeconds") return [`${num}s`, "Max"];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="avgSeconds" name="Average" fill="#FF6600" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minSeconds" name="Min" fill="#6e7681" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maxSeconds" name="Max" fill="#8b949e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No timing data yet — new responses will include per-question times." />
          )}
        </ChartCard>

        <ChartCard
          title="Responses over time"
          description="Submissions grouped by day"
        >
          {insights.responseTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={insights.responseTimeline}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="responseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6600" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#FF6600" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="#8b949e"
                  tickFormatter={(value: string) =>
                    new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#8b949e" width={28} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(label) =>
                    new Date(`${label}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Responses"
                  stroke="#FF6600"
                  fill="url(#responseFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No timeline data yet." />
          )}
        </ChartCard>
      </section>

      {insights.completionTimes.some((item) => item.seconds > 0) && (
        <ChartCard
          title="Completion times"
          description="Total survey duration for recent responses (seconds)"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={insights.completionTimes}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#8b949e" />
              <YAxis tick={{ fontSize: 12 }} stroke="#8b949e" unit="s" width={36} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [
                  `${typeof value === "number" ? value : 0}s`,
                  "Duration",
                ]}
              />
              <Bar dataKey="seconds" name="Duration" fill="#8b949e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Question insights</h2>
          <p className="text-sm text-muted-foreground">
            Answer distributions and time spent per screen
            {choicePieData > 0 ? " — charts below." : "."}
          </p>
        </div>

        <div className="space-y-4">
          {insights.questions.map((question) => (
            <QuestionInsightCard
              key={question.questionId}
              question={question}
              responseCount={insights.responseCount}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Individual responses</h2>
          <p className="text-sm text-muted-foreground">
            Expand a row to see each answer and time on question.
          </p>
        </div>

        {deleteError ? (
          <p className="rounded-lg border border-negative/40 bg-negative-dim px-3 py-2 text-sm text-negative">
            {deleteError}
          </p>
        ) : null}

        <ResponseTimingHeatmap
          questions={insights.questions}
          submissions={insights.submissions}
        />

        <div className="space-y-3">
          {insights.submissions.map((submission) => (
            <details
              key={submission.id}
              className="group rounded-xl border border-border bg-card shadow-sm"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 marker:content-none">
                <div>
                  <p className="font-medium text-foreground">
                    {new Date(submission.submittedAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{submission.id}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Total:{" "}
                    <span className="font-medium text-foreground">
                      {formatDuration(submission.totalDurationMs)}
                    </span>
                  </span>
                  {canDeleteResponses ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void deleteSubmission(submission.id);
                      }}
                      disabled={deletingId === submission.id}
                      className="rounded border border-negative/40 px-2.5 py-1 text-xs font-medium text-negative transition hover:border-negative hover:bg-negative-dim disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === submission.id ? "Deleting…" : "Delete"}
                    </button>
                  ) : null}
                  <span className="text-fg-faint transition group-open:rotate-180">
                    ▾
                  </span>
                </div>
              </summary>

              <div className="border-t border-border px-5 py-4">
                <SubmissionTimingBars submission={submission} />
                <dl className="mt-4 space-y-4">
                  {submission.answers.map((answer) => (
                    <div
                      key={answer.questionId}
                      className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
                    >
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Q{answer.order}
                        </dt>
                        <dd className="mt-0.5 text-sm font-medium text-foreground">
                          {answer.prompt}
                        </dd>
                      </div>
                      <div className="text-sm text-foreground sm:text-right">
                        {answer.valueLabel}
                      </div>
                      <div className="text-sm text-muted-foreground sm:text-right sm:tabular-nums">
                        {formatDuration(answer.durationMs)}
                      </div>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border bg-muted px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function QuestionInsightCard({
  question,
  responseCount,
}: {
  question: QuestionInsight;
  responseCount: number;
}) {
  const timing = question.timing;
  const choiceData =
    question.choiceBuckets?.map((bucket, index) => ({
      name: bucket.label,
      value: bucket.count,
      fill: CHART_PALETTE[index % CHART_PALETTE.length],
    })) ?? [];

  const hasChoiceData = choiceData.some((item) => item.value > 0);
  const isSingleChoice = question.type === "SINGLE_CHOICE";

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Question {question.order} · {question.type.replaceAll("_", " ")}
          </p>
          <h3 className="mt-1 text-base font-medium text-foreground">
            {question.prompt}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{question.summary}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg time</p>
          <p className="font-semibold text-foreground">
            {formatDuration(timing?.avgMs ?? null)}
          </p>
          {timing && (
            <p className="text-xs text-muted-foreground">
              {formatDuration(timing.minMs)} – {formatDuration(timing.maxMs)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {hasChoiceData && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {question.type === "POINT_ALLOCATION"
                ? "Points allocated"
                : "Answer distribution"}
            </p>
            {isSingleChoice && choiceData.length <= 6 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={choiceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {choiceData.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={choiceData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#8b949e" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="#8b949e"
                    width={100}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Responses" radius={[0, 4, 4, 0]}>
                    {choiceData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {question.choiceBuckets?.map((bucket) => (
                <span
                  key={bucket.value}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {question.type === "POINT_ALLOCATION" ? (
                    <>
                      {bucket.label}: {bucket.count} pts
                      {responseCount > 0 &&
                        ` (avg ${(bucket.count / responseCount).toFixed(1)})`}
                    </>
                  ) : (
                    <>
                      {bucket.label}: {bucket.count}
                      {responseCount > 0 &&
                        ` (${Math.round((bucket.count / responseCount) * 100)}%)`}
                    </>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {question.numericDistribution &&
          question.numericDistribution.some((bucket) => bucket.count > 0) && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Score distribution
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={question.numericDistribution}
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#8b949e" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#8b949e" width={28} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Responses" fill="#FF6600" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        {timing && !hasChoiceData && !question.numericDistribution && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Time on question
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={[
                  { label: "Min", seconds: timing.minMs / 1000 },
                  { label: "Avg", seconds: timing.avgMs / 1000 },
                  { label: "Max", seconds: timing.maxMs / 1000 },
                ]}
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#8b949e" />
                <YAxis tick={{ fontSize: 11 }} stroke="#8b949e" unit="s" width={36} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [
                    `${typeof value === "number" ? value.toFixed(1) : "0"}s`,
                    "Time",
                  ]}
                />
                <Bar dataKey="seconds" fill="#FF6600" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {question.textResponses && question.textResponses.length > 0 && (
        <TextResponsesList responses={question.textResponses} />
      )}
    </article>
  );
}

const INITIAL_TEXT_RESPONSES = 3;

function TextResponsesList({
  responses,
}: {
  responses: Array<{ value: string; durationMs: number | null }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? responses
    : responses.slice(0, INITIAL_TEXT_RESPONSES);
  const hiddenCount = responses.length - INITIAL_TEXT_RESPONSES;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <ul className="space-y-2">
        {visible.map((response, index) => (
          <li
            key={`${response.value}-${index}`}
            className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
          >
            <span className="text-foreground">{response.value}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatDuration(response.durationMs)}
            </span>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-muted-foreground hover:bg-muted"
          aria-expanded={expanded}
        >
          <span
            className={`inline-block text-xs transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
          {expanded
            ? "Show less"
            : `Show ${hiddenCount} more response${hiddenCount === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

function ResponseTimingHeatmap({
  questions,
  submissions,
}: {
  questions: QuestionInsight[];
  submissions: SurveyInsights["submissions"];
}) {
  const timedQuestions = questions.filter((question) => question.timing);
  const recentSubmissions = submissions.slice(0, 12);

  if (timedQuestions.length === 0 || recentSubmissions.length === 0) {
    return null;
  }

  const maxMs = Math.max(
    ...recentSubmissions.flatMap((submission) =>
      submission.answers.map((answer) => answer.durationMs ?? 0),
    ),
    1,
  );

  return (
    <ChartCard
      title="Time heatmap"
      description="Recent responses — darker cells mean more time on that question"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="pb-2 pr-2 text-left font-medium text-muted-foreground">Response</th>
              {timedQuestions.map((question) => (
                <th
                  key={question.questionId}
                  className="px-1 pb-2 text-center font-medium text-muted-foreground"
                  title={question.prompt}
                >
                  Q{question.order}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentSubmissions.map((submission, rowIndex) => (
              <tr key={submission.id}>
                <td className="py-1 pr-2 text-muted-foreground">#{rowIndex + 1}</td>
                {timedQuestions.map((question) => {
                  const answer = submission.answers.find(
                    (item) => item.questionId === question.questionId,
                  );
                  const ms = answer?.durationMs ?? 0;
                  const intensity = ms > 0 ? Math.max(0.12, ms / maxMs) : 0;
                  return (
                    <td key={question.questionId} className="p-1">
                      <div
                        className="flex h-8 items-center justify-center rounded-md text-[10px] font-medium tabular-nums"
                        style={{
                          backgroundColor: `rgba(255, 102, 0, ${intensity})`,
                          color: intensity > 0.55 ? "#ffffff" : "#8b949e",
                        }}
                        title={`${formatDuration(ms)} on Q${question.order}`}
                      >
                        {ms > 0 ? formatDuration(ms) : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function SubmissionTimingBars({
  submission,
}: {
  submission: SurveyInsights["submissions"][number];
}) {
  const data = submission.answers
    .filter((answer) => answer.durationMs != null && answer.durationMs > 0)
    .map((answer) => ({
      name: `Q${answer.order}`,
      seconds: Math.round((answer.durationMs! / 1000) * 10) / 10,
    }));

  if (data.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Time per question
      </p>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#8b949e" unit="s" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#8b949e" width={32} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [
              `${typeof value === "number" ? value : 0}s`,
              "Time",
            ]}
          />
          <Bar dataKey="seconds" fill="#FF6600" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
