import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const forms = await prisma.form.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      title: true,
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Internal forms
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
          Survey App
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Self-hosted one-question-at-a-time surveys for internal teams.
        </p>

        <div className="mt-8 space-y-3">
          {forms.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500">
              No surveys published yet.
            </p>
          ) : (
            forms.map((form) => (
              <Link
                key={form.slug}
                href={`/q/${form.slug}`}
                className="flex items-center justify-between rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-900 hover:bg-zinc-50"
              >
                <span>{form.title}</span>
                <span aria-hidden>→</span>
              </Link>
            ))
          )}
          <Link
            href="/admin/forms"
            className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50"
          >
            <span>Admin — create & manage surveys</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
