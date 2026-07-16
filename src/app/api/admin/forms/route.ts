import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import {
  normalizeCreateFormInput,
  validateCreateFormInput,
  type CreateFormInput,
} from "@/lib/form-create";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const forms = await prisma.form.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          questions: true,
          submissions: true,
        },
      },
    },
  });

  return NextResponse.json({
    forms: forms.map((form) => ({
      id: form.id,
      slug: form.slug,
      title: form.title,
      description: form.description,
      createdAt: form.createdAt,
      questionCount: form._count.questions,
      submissionCount: form._count.submissions,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: CreateFormInput;
  try {
    body = (await request.json()) as CreateFormInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const normalized = normalizeCreateFormInput(body);
  const errors = validateCreateFormInput(normalized);

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  try {
    const form = await prisma.form.create({
      data: {
        slug: normalized.slug,
        title: normalized.title,
        description: normalized.description,
        themeId: normalized.themeId ?? "default",
        anonymous: normalized.anonymous ?? false,
        questions: {
          create: normalized.questions.map((question) => ({
            order: question.order,
            type: question.type,
            prompt: question.prompt,
            required: question.required,
            options: question.options as Prisma.InputJsonValue,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(
      {
        slug: form.slug,
        title: form.title,
        url: `/q/${form.slug}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A form with this URL slug already exists." },
        { status: 409 },
      );
    }

    console.error("Failed to create form:", error);
    return NextResponse.json(
      { error: "Could not create form." },
      { status: 500 },
    );
  }
}
