import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteSubmissionButton } from "@/components/admin/DeleteSubmissionButton";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/survey-insights";
import { AuthzError, groupIdsForUser, requireActor } from "@/lib/session";
import { listAccessibleForms } from "@/lib/tenant-forms";
import { formatAnswerValue, isAttachmentAnswer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  let submissions;
  const deletableFormIds = new Set<string>();

  try {
    const actor = await requireActor();
    const accessible = await listAccessibleForms(actor);
    const readableIds = new Set<string>();
    const groupIds = await groupIdsForUser(actor);

    for (const form of accessible) {
      const authzForm = {
        id: form.id,
        ownerUserId: form.ownerUserId,
        access: form.access,
      };
      if (can(actor, "form:view_responses", authzForm, groupIds)) {
        readableIds.add(form.id);
      }
      if (can(actor, "form:delete_responses", authzForm, groupIds)) {
        deletableFormIds.add(form.id);
      }
    }

    submissions = await prisma.submission.findMany({
      where: { formId: { in: [...readableIds] } },
      orderBy: { submittedAt: "desc" },
      take: 50,
      include: {
        form: true,
        answers: {
          include: { question: true },
          orderBy: { question: { order: "asc" } },
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) {
      redirect("/api/auth/signin?callbackUrl=/admin/submissions");
    }
    throw error;
  }

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Submissions</h1>
            <p className="text-sm text-zinc-500">
              Recent form responses (latest 50)
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        {submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            No submissions yet for surveys you can access.
          </div>
        ) : (
          submissions.map((submission) => (
            <article
              key={submission.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-100 pb-3">
                <div>
                  <h2 className="font-medium text-zinc-900">
                    <Link
                      href={`/admin/forms/${submission.form.slug}/insights`}
                      className="hover:underline"
                    >
                      {submission.form.title}
                    </Link>
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {submission.form.slug} · {submission.id}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right text-xs text-zinc-500">
                  <time dateTime={submission.submittedAt.toISOString()}>
                    {submission.submittedAt.toLocaleString()}
                  </time>
                  {submission.totalDurationMs != null && (
                    <p>Total time: {formatDuration(submission.totalDurationMs)}</p>
                  )}
                  {deletableFormIds.has(submission.formId) ? (
                    <DeleteSubmissionButton
                      formSlug={submission.form.slug}
                      submissionId={submission.id}
                    />
                  ) : null}
                </div>
              </div>

              <dl className="mt-4 space-y-3">
                {submission.answers.map((answer) => {
                  const attachment = isAttachmentAnswer(answer.value)
                    ? answer.value
                    : null;
                  return (
                    <div key={answer.id}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Q{answer.question.order}: {answer.question.prompt}
                      </dt>
                      <dd className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-sm text-zinc-900">
                        <span>
                          {attachment ? (
                            <a
                              href={attachment.downloadUrl}
                              className="underline underline-offset-2"
                            >
                              {attachment.filename}
                            </a>
                          ) : (
                            formatAnswerValue(answer.value)
                          )}
                        </span>
                        {answer.durationMs != null && (
                          <span className="text-xs text-zinc-500 tabular-nums">
                            {formatDuration(answer.durationMs)}
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))
        )}
      </div>
    </>
  );
}
