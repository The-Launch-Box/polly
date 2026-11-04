import Link from "next/link";
import type { Metadata } from "next";
import { LaunchBoxWordmark } from "@/components/LaunchBoxWordmark";

export const metadata: Metadata = {
  title: "Unauthorized · The Launch Box",
  description: "You do not have permission to access this page.",
};

export default function UnauthorizedPage() {
  return (
    <main className="tlb-shell relative flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <LaunchBoxWordmark href="/" />
      </div>

      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Access
        </p>
        <h1 className="mt-2 text-4xl text-foreground">Unauthorized</h1>
        <p className="mt-3 font-sans text-sm font-normal normal-case tracking-normal text-muted-foreground">
          You do not have permission to access this page. Contact your
          administrators if you are outside of The Launch Box&apos;s portfolio
          companies.
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <span>Back to home</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
