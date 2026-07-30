import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormBuilder } from "@/components/admin/FormBuilder";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  AuthzError,
  groupIdsForUser,
  loadFormAuthzContext,
  requireActor,
} from "@/lib/session";
import type { QuestionOptions, QuestionVisibility } from "@/lib/types";

export const dynamic = "force-dynamic";

type EditFormPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditFormPage({ params }: EditFormPageProps) {
  const { slug } = await params;

  let form;
  try {
    const actor = await requireActor();
    const authzForm = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);
    if (!can(actor, "form:edit", authzForm, groupIds)) {
      notFound();
    }

    form = await prisma.form.findFirst({
      where: { slug, organizationId: actor.organizationId },
      include: {
        questions: { orderBy: { order: "asc" } },
        webhooks: true,
        _count: { select: { submissions: true } },
      },
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      if (error.status === 401) {
        redirect(`/api/auth/signin?callbackUrl=/admin/forms/${slug}/edit`);
      }
      notFound();
    }
    throw error;
  }

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
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/forms/${form.slug}/sharing`}
              className="text-sm text-zinc-500 transition hover:text-zinc-800"
            >
              Sharing
            </Link>
            <Link
              href="/admin/forms"
              className="text-sm text-zinc-500 transition hover:text-zinc-800"
            >
              All surveys
            </Link>
          </div>
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
              visibility: question.visibility as QuestionVisibility | null,
            })),
          }}
        />
      </div>
    </>
  );
}
