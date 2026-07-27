import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <Link
        href="https://thelaunchbox.com"
        className="absolute left-4 top-4 sm:left-6 sm:top-6"
        aria-label="The Launch Box"
      >
        <Image
          src="/company-themes/launch-box.png"
          alt="The Launch Box"
          width={120}
          height={28}
          className="h-7 w-auto"
          priority
        />
      </Link>

      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Internal forms
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
          Survey App
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Self-hosted one-question-at-a-time surveys for internal teams. Each
          organization&apos;s survey data is isolated in its own database schema.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/admin/forms"
            className="flex items-center justify-between rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-900 hover:bg-zinc-50"
          >
            <span>Admin — create & manage surveys</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
