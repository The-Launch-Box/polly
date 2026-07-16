import { prisma } from "@/lib/prisma";

export async function fireWebhooks(
  formId: string,
  formSlug: string,
  submissionId: string,
  submittedAt: Date,
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({ where: { formId } });
  if (webhooks.length === 0) return;

  const isHttps = (url: string) => new URL(url).protocol === "https:";

  const needsAnswers = webhooks.some((w) => w.includeAnswers && isHttps(w.url));
  const answers = needsAnswers
    ? await prisma.answer.findMany({ where: { submissionId } })
    : [];

  const basePayload = {
    event: "form.submitted",
    submissionId,
    formId,
    formSlug,
    submittedAt,
  };

  await Promise.allSettled(
    webhooks.map((webhook) => {
      const canSendAnswers = webhook.includeAnswers && isHttps(webhook.url);
      const payload = canSendAnswers
        ? { ...basePayload, answers: answers.map((a) => ({ questionId: a.questionId, value: a.value })) }
        : basePayload;
      return fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }),
  );
}
