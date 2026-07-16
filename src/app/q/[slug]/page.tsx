import { notFound } from "next/navigation";
import { SurveyHeader } from "@/components/SurveyHeader";
import { SurveyThemeProvider } from "@/components/SurveyThemeProvider";
import { FormPlayer } from "@/components/FormPlayer";
import { getFormBySlug } from "@/lib/forms";

export const dynamic = "force-dynamic";

type FormPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function FormPage({ params }: FormPageProps) {
  const { slug } = await params;
  const form = await getFormBySlug(slug);

  if (!form) {
    notFound();
  }

  return (
    <SurveyThemeProvider themeId={form.themeId}>
      <main className="min-h-screen">
        <SurveyHeader title={form.title} />

        {form.description && (
          <p
            className="mx-auto max-w-2xl px-4 pt-6 text-sm"
            style={{ color: "var(--theme-text-muted)" }}
          >
            {form.description}
          </p>
        )}

        <FormPlayer form={form} />
      </main>
    </SurveyThemeProvider>
  );
}
