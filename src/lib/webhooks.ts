import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export function generateWebhookSecret(): string {
  return randomBytes(16).toString("hex");
}

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

  const results = await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const canSendAnswers = webhook.includeAnswers && isHttps(webhook.url);
      const payload = canSendAnswers
        ? { ...basePayload, answers: Object.fromEntries(answers.map((a) => [a.questionId, a.value])) }
        : basePayload;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (webhook.secret) headers["x-secret"] = webhook.secret;
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      return { webhook, response };
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        `[webhook] FAILED to reach "${result.reason instanceof Error ? result.reason.message : String(result.reason)}"`,
      );
    } else {
      const { webhook, response } = result.value;
      if (response.ok) {
        console.log(`[webhook] OK ${response.status} → ${webhook.url}`);
      } else {
        const body = await response.text().catch(() => "(unreadable)");
        console.error(
          `[webhook] ERROR ${response.status} → ${webhook.url}\n  Response: ${body}`,
        );
      }
    }
  }
}
