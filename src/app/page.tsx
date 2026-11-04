import Link from "next/link";
import { LaunchBoxWordmark } from "@/components/LaunchBoxWordmark";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="tlb-shell relative flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <LaunchBoxWordmark href="https://thelaunchbox.com" />
      </div>

      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Internal surveys
        </p>
        <h1 className="mt-2 text-4xl text-tlb-orange">Polly</h1>
        <p className="mt-3 font-sans text-sm font-normal normal-case tracking-normal text-muted-foreground">
          One-question-at-a-time surveys for internal teams. Each
          organization&apos;s responses stay in their own database schema.
        </p>

        <div className="mt-8">
          <Link
            href="/admin/forms"
            className="inline-flex items-center justify-between gap-6 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent-soft"
          >
            <span>Open surveys</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
