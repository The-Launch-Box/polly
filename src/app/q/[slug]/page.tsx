import Link from "next/link";
import { notFound } from "next/navigation";
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
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Internal survey
            </p>
            <h1 className="text-lg font-semibold text-zinc-900">{form.title}</h1>
          </div>
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            Home
          </Link>
        </div>
      </header>

      {form.description && (
        <p className="mx-auto max-w-2xl px-4 pt-6 text-sm text-zinc-600">
          {form.description}
        </p>
      )}

      <FormPlayer form={form} />
    </main>
  );
}
