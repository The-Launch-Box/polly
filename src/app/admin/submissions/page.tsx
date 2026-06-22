import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAnswerValue } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  const submissions = await prisma.submission.findMany({
    orderBy: { submittedAt: "desc" },
    take: 50,
    include: {
      form: true,
      answers: {
        include: {
          question: true,
        },
        orderBy: {
          question: {
            order: "asc",
          },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Submissions</h1>
            <p className="text-sm text-zinc-500">
              Recent form responses (latest 50)
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        {submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            No submissions yet. Complete a form at{" "}
            <Link href="/q/claude-comfort" className="text-zinc-800 underline">
              /q/claude-comfort
            </Link>
            .
          </div>
        ) : (
          submissions.map((submission) => (
            <article
              key={submission.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-100 pb-3">
                <div>
                  <h2 className="font-medium text-zinc-900">
                    {submission.form.title}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {submission.form.slug} · {submission.id}
                  </p>
                </div>
                <time
                  dateTime={submission.submittedAt.toISOString()}
                  className="text-xs text-zinc-500"
                >
                  {submission.submittedAt.toLocaleString()}
                </time>
              </div>

              <dl className="mt-4 space-y-3">
                {submission.answers.map((answer) => (
                  <div key={answer.id}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Q{answer.question.order}: {answer.question.prompt}
                    </dt>
                    <dd className="mt-1 text-sm text-zinc-900">
                      {formatAnswerValue(answer.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
