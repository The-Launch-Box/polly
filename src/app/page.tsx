import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Internal forms
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
          Typeform Alt
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Self-hosted one-question-at-a-time surveys for internal teams.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/q/claude-comfort"
            className="flex items-center justify-between rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-900 hover:bg-zinc-50"
          >
            <span>How comfortable with Claude are you?</span>
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/admin/submissions"
            className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50"
          >
            <span>View submissions (admin)</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
