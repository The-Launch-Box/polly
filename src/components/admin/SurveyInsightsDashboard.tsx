"use client";

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
  "#18181b",
  "#3f3f46",
  "#52525b",
  "#71717a",
  "#2563eb",
  "#7c3aed",
  "#0d9488",
  "#ea580c",
  "#ca8a04",
  "#db2777",
];

const TOOLTIP_STYLE = {
  borderRadius: "8px",
  border: "1px solid #e4e4e7",
  fontSize: "12px",
};

type SurveyInsightsDashboardProps = {
  insights: SurveyInsights;
};

export function SurveyInsightsDashboard({
  insights,
}: SurveyInsightsDashboardProps) {
  if (insights.responseCount === 0) {
    return null;
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="question" tick={{ fontSize: 12 }} stroke="#a1a1aa" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#a1a1aa"
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
                <Bar dataKey="avgSeconds" name="Average" fill="#18181b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minSeconds" name="Min" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maxSeconds" name="Max" fill="#52525b" radius={[4, 4, 0, 0]} />
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
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="#a1a1aa"
                  tickFormatter={(value: string) =>
                    new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#a1a1aa" width={28} />
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
                  stroke="#2563eb"
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#a1a1aa" />
              <YAxis tick={{ fontSize: 12 }} stroke="#a1a1aa" unit="s" width={36} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [
                  `${typeof value === "number" ? value : 0}s`,
                  "Duration",
                ]}
              />
              <Bar dataKey="seconds" name="Duration" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Question insights</h2>
          <p className="text-sm text-zinc-500">
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
          <h2 className="text-lg font-semibold text-zinc-900">Individual responses</h2>
          <p className="text-sm text-zinc-500">
            Expand a row to see each answer and time on question.
          </p>
        </div>

        <ResponseTimingHeatmap
          questions={insights.questions}
          submissions={insights.submissions}
        />

        <div className="space-y-3">
          {insights.submissions.map((submission) => (
            <details
              key={submission.id}
              className="group rounded-xl border border-zinc-200 bg-white shadow-sm"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 marker:content-none">
                <div>
                  <p className="font-medium text-zinc-900">
                    {new Date(submission.submittedAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-500">{submission.id}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-zinc-500">
                    Total:{" "}
                    <span className="font-medium text-zinc-800">
                      {formatDuration(submission.totalDurationMs)}
                    </span>
                  </span>
                  <span className="text-zinc-400 transition group-open:rotate-180">
                    ▾
                  </span>
                </div>
              </summary>

              <div className="border-t border-zinc-100 px-5 py-4">
                <SubmissionTimingBars submission={submission} />
                <dl className="mt-4 space-y-4">
                  {submission.answers.map((answer) => (
                    <div
                      key={answer.questionId}
                      className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
                    >
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Q{answer.order}
                        </dt>
                        <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                          {answer.prompt}
                        </dd>
                      </div>
                      <div className="text-sm text-zinc-700 sm:text-right">
                        {answer.valueLabel}
                      </div>
                      <div className="text-sm text-zinc-500 sm:text-right sm:tabular-nums">
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
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-6 text-center text-sm text-zinc-500">
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
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Question {question.order} · {question.type.replaceAll("_", " ")}
          </p>
          <h3 className="mt-1 text-base font-medium text-zinc-900">
            {question.prompt}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">{question.summary}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Avg time</p>
          <p className="font-semibold text-zinc-900">
            {formatDuration(timing?.avgMs ?? null)}
          </p>
          {timing && (
            <p className="text-xs text-zinc-500">
              {formatDuration(timing.minMs)} – {formatDuration(timing.maxMs)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {hasChoiceData && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Answer distribution
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="#a1a1aa"
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
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                >
                  {bucket.label}: {bucket.count}
                  {responseCount > 0 &&
                    ` (${Math.round((bucket.count / responseCount) * 100)}%)`}
                </span>
              ))}
            </div>
          </div>
        )}

        {question.numericDistribution &&
          question.numericDistribution.some((bucket) => bucket.count > 0) && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Score distribution
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={question.numericDistribution}
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#a1a1aa" width={28} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Responses" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        {timing && !hasChoiceData && !question.numericDistribution && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" unit="s" width={36} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [
                    `${typeof value === "number" ? value.toFixed(1) : "0"}s`,
                    "Time",
                  ]}
                />
                <Bar dataKey="seconds" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {question.textResponses && question.textResponses.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-zinc-100 pt-4">
          {question.textResponses.map((response, index) => (
            <li
              key={`${response.value}-${index}`}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm"
            >
              <span className="text-zinc-800">{response.value}</span>
              <span className="text-zinc-500 tabular-nums">
                {formatDuration(response.durationMs)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
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
              <th className="pb-2 pr-2 text-left font-medium text-zinc-500">Response</th>
              {timedQuestions.map((question) => (
                <th
                  key={question.questionId}
                  className="px-1 pb-2 text-center font-medium text-zinc-500"
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
                <td className="py-1 pr-2 text-zinc-600">#{rowIndex + 1}</td>
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
                          backgroundColor: `rgba(24, 24, 27, ${intensity})`,
                          color: intensity > 0.55 ? "#fff" : "#52525b",
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
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Time per question
      </p>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#a1a1aa" unit="s" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#a1a1aa" width={32} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [
              `${typeof value === "number" ? value : 0}s`,
              "Time",
            ]}
          />
          <Bar dataKey="seconds" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
