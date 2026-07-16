import Link from "next/link";
import { notFound } from "next/navigation";
import { FormBuilder } from "@/components/admin/FormBuilder";
import { prisma } from "@/lib/prisma";
import type { QuestionOptions } from "@/lib/types";

export const dynamic = "force-dynamic";

type EditFormPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditFormPage({ params }: EditFormPageProps) {
  const { slug } = await params;

  const form = await prisma.form.findUnique({
    where: { slug },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      webhooks: true,
      _count: {
        select: { submissions: true },
      },
    },
  });

  if (!form) {
    notFound();
  }

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Edit survey</h1>
            <p className="text-sm text-zinc-500">
              Update questions and details for{" "}
              <span className="font-medium text-zinc-700">{form.title}</span>.
            </p>
          </div>
          <Link
            href="/admin/forms"
            className="text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            All surveys
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <FormBuilder
          mode="edit"
          originalSlug={form.slug}
          submissionCount={form._count.submissions}
          initialWebhooks={form.webhooks.map((wh) => ({
            id: wh.id,
            name: wh.name,
            url: wh.url,
            includeAnswers: wh.includeAnswers,
            secret: wh.secret,
          }))}
          initialData={{
            slug: form.slug,
            title: form.title,
            description: form.description,
            themeId: form.themeId,
            anonymous: form.anonymous,
            questions: form.questions.map((question) => ({
              id: question.id,
              order: question.order,
              type: question.type,
              prompt: question.prompt,
              required: question.required,
              options: question.options as QuestionOptions,
            })),
          }}
        />
      </div>
    </>
  );
}
