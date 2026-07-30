import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unauthorized — Survey App",
  description: "You do not have permission to access this page.",
};

export default function UnauthorizedPage() {
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
        <h1 className="text-3xl font-semibold text-zinc-900">Sorry!</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          You do not have permission to access this page. Contact your
          administrators if you are outside of The Launch Box&apos;s portfolio
          companies.
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-900 hover:bg-zinc-50"
          >
            <span>Back to home</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
