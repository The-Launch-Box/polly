import { NextResponse } from "next/server";
import { can } from "@/lib/authz";
import {
  buildSurveyExportCsv,
  buildSurveyInsightsForExport,
} from "@/lib/survey-export";
import { prisma } from "@/lib/prisma";
import {
  AuthzError,
  groupIdsForUser,
  loadFormAuthzContext,
  requireActor,
} from "@/lib/session";
import type { QuestionOptions } from "@/lib/types";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug } = await context.params;
    const authzForm = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:export", authzForm, groupIds)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const form = await prisma.form.findFirst({
      where: { slug, organizationId: actor.organizationId },
      include: {
        questions: { orderBy: { order: "asc" } },
        submissions: {
          orderBy: { submittedAt: "desc" },
          include: { answers: true },
        },
      },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const insights = buildSurveyInsightsForExport(
      {
        id: form.id,
        slug: form.slug,
        title: form.title,
        questions: form.questions.map((question) => ({
          id: question.id,
          order: question.order,
          type: question.type,
          prompt: question.prompt,
          options: question.options as QuestionOptions | null,
        })),
      },
      form.submissions.map((submission) => ({
        id: submission.id,
        submittedAt: submission.submittedAt,
        totalDurationMs: submission.totalDurationMs,
        answers: submission.answers.map((answer) => ({
          questionId: answer.questionId,
          value: answer.value,
          durationMs: answer.durationMs,
        })),
      })),
    );

    const csv = `\uFEFF${buildSurveyExportCsv(form.id, insights)}`;
    const filename = `${slug}-survey-export.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
