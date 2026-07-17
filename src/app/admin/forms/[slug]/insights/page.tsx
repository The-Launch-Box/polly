import Link from "next/link";
import { notFound } from "next/navigation";
import { SurveyInsightsDashboard } from "@/components/admin/SurveyInsightsDashboard";
import { buildSurveyInsights, formatDuration } from "@/lib/survey-insights";
import { prisma } from "@/lib/prisma";
import type { QuestionOptions } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SurveyInsightsPage({ params }: PageProps) {
  const { slug } = await params;

  const form = await prisma.form.findUnique({
    where: { slug },
    include: {
      questions: { orderBy: { order: "asc" } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        include: {
          answers: true,
        },
      },
    },
  });

  if (!form) {
    notFound();
  }

  const insights = buildSurveyInsights(
    {
      slug: form.slug,
      title: form.title,
      questions: form.questions.map((question) => ({
        id: question.id,
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        options: question.options as QuestionOptions | null,
      })),
    },
    form.submissions.map((submission) => ({
      id: submission.id,
      submittedAt: submission.submittedAt,
      totalDurationMs: submission.totalDurationMs,
      answers: submission.answers.map((answer) => ({
        questionId: answer.questionId,
        value: answer.value,
        durationMs: answer.durationMs,
      })),
    })),
  );

  const serializedInsights = {
    ...insights,
    submissions: insights.submissions.map((submission) => ({
      ...submission,
      submittedAt:
        submission.submittedAt instanceof Date
          ? submission.submittedAt.toISOString()
          : submission.submittedAt,
    })),
  };

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Survey dashboard
            </p>
            <h1 className="text-xl font-semibold text-zinc-900">{form.title}</h1>
            <p className="text-sm text-zinc-500">/q/{form.slug}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`/api/admin/forms/${form.slug}/export`}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              Export CSV
            </a>
            <Link
              href={`/q/${form.slug}`}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
            >
              Open survey
            </Link>
            <Link
              href={`/admin/forms/${form.slug}/edit`}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
            >
              Edit survey
            </Link>
            <Link
              href="/admin/forms"
              className="text-sm text-zinc-500 transition hover:text-zinc-800"
            >
              All surveys
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Responses" value={String(insights.responseCount)} />
          <StatCard
            label="Avg completion time"
            value={formatDuration(insights.avgTotalDurationMs)}
          />
          <StatCard label="Questions" value={String(insights.questions.length)} />
        </section>

        {insights.responseCount === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            No responses yet. Share{" "}
            <Link href={`/q/${form.slug}`} className="text-zinc-800 underline">
              /q/{form.slug}
            </Link>{" "}
            to start collecting data.
          </div>
        ) : (
          <SurveyInsightsDashboard insights={serializedInsights} />
        )}
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
