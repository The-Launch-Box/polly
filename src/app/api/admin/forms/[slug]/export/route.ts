import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildSurveyExportCsv,
  buildSurveyInsightsForExport,
} from "@/lib/survey-export";
import { prisma } from "@/lib/prisma";
import type { QuestionOptions } from "@/lib/types";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { slug } = await context.params;

  const form = await prisma.form.findUnique({
    where: { slug },
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
}
