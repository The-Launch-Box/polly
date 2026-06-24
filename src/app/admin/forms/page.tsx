import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminFormsPage() {
  const forms = await prisma.form.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          questions: true,
          submissions: true,
        },
      },
    },
  });

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Surveys</h1>
            <p className="text-sm text-zinc-500">
              Create and share internal one-question-at-a-time forms.
            </p>
          </div>
          <Link
            href="/admin/forms/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Create survey
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {forms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center">
            <p className="text-sm text-zinc-500">No surveys yet.</p>
            <Link
              href="/admin/forms/new"
              className="mt-3 inline-block text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Create your first survey
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map((form) => (
              <article
                key={form.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <h2 className="font-medium text-zinc-900">{form.title}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    /q/{form.slug} · {form._count.questions} question
                    {form._count.questions === 1 ? "" : "s"} ·{" "}
                    {form._count.submissions} submission
                    {form._count.submissions === 1 ? "" : "s"}
                  </p>
                  {form.description && (
                    <p className="mt-2 text-sm text-zinc-600">
                      {form.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/forms/${form.slug}/edit`}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/q/${form.slug}`}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
                  >
                    Open survey
                  </Link>
                  <Link
                    href="/admin/submissions"
                    className="text-sm text-zinc-500 transition hover:text-zinc-800"
                  >
                    Submissions
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
