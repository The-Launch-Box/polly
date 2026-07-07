import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  normalizeFormInput,
  validateFormInput,
  type UpdateFormInput,
} from "@/lib/form-create";
import { FormUpdateError, updateFormBySlug } from "@/lib/form-update";
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
      questions: {
        orderBy: { order: "asc" },
      },
      _count: {
        select: { submissions: true },
      },
    },
  });

  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  return NextResponse.json({
    slug: form.slug,
    title: form.title,
    description: form.description,
    themeId: form.themeId,
    anonymous: form.anonymous,
    submissionCount: form._count.submissions,
    questions: form.questions.map((question) => ({
      id: question.id,
      order: question.order,
      type: question.type,
      prompt: question.prompt,
      required: question.required,
      options: question.options as QuestionOptions,
    })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { slug } = await context.params;

  let body: UpdateFormInput;
  try {
    body = (await request.json()) as UpdateFormInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const normalized = normalizeFormInput(body);
  const errors = validateFormInput(normalized);

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  try {
    const form = await updateFormBySlug(slug, normalized);

    return NextResponse.json({
      slug: form?.slug,
      title: form?.title,
      url: `/q/${form?.slug}`,
    });
  } catch (error) {
    if (error instanceof FormUpdateError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "SLUG_CONFLICT"
            ? 409
            : 400;

      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("Form update failed:", error);
    return NextResponse.json(
      { error: "Could not save changes." },
      { status: 500 },
    );
  }
}
