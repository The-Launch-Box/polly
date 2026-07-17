import Link from "next/link";
import { notFound } from "next/navigation";
import { SurveyHeader } from "@/components/SurveyHeader";
import { SurveyThemeProvider } from "@/components/SurveyThemeProvider";
import { getFormBySlug } from "@/lib/forms";

type ThankYouPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ThankYouPage({ params }: ThankYouPageProps) {
  const { slug } = await params;
  const form = await getFormBySlug(slug);

  if (!form) {
    notFound();
  }

  return (
    <SurveyThemeProvider themeId={form.themeId}>
      <main className="min-h-screen">
        <SurveyHeader title={form.title} showHomeLink={false} />

        <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
          <div
            className="w-full max-w-md rounded-2xl border p-8 text-center shadow-sm"
            style={{
              borderColor: "var(--theme-border)",
              backgroundColor: "var(--theme-surface)",
            }}
          >
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold"
              style={{
                backgroundColor: "var(--theme-progress-track)",
                color: "var(--theme-primary)",
              }}
            >
              ✓
            </div>
            <h1
              className="text-2xl font-semibold"
              style={{ color: "var(--theme-text)" }}
            >
              Thank you!
            </h1>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--theme-text-muted)" }}
            >
              Your response has been recorded.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={`/q/${slug}`}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-90"
                style={{
                  borderColor: "var(--theme-border)",
                  color: "var(--theme-text)",
                  backgroundColor: "var(--theme-surface)",
                }}
              >
                Submit another response
              </Link>
              <Link
                href="/"
                className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-80"
                style={{ color: "var(--theme-text-muted)" }}
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </SurveyThemeProvider>
  );
}
