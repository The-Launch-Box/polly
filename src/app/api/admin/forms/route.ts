import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/authz";
import {
  normalizeCreateFormInput,
  validateCreateFormInput,
  type CreateFormInput,
} from "@/lib/form-create";
import { upsertPublicFormRoute } from "@/lib/form-routes";
import { prisma } from "@/lib/prisma";
import { AuthzError, requireActor } from "@/lib/session";
import { listAccessibleForms } from "@/lib/tenant-forms";
import { mirrorFormRowToTenant } from "@/lib/tenant-pg";

function authzResponse(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

export async function GET() {
  try {
    const actor = await requireActor();
    const forms = await listAccessibleForms(actor);

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
  } catch (error) {
    return authzResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (!can(actor, "form:create")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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

    const slugTaken = await prisma.publicFormRoute.findUnique({
      where: { slug: normalized.slug },
    });
    if (slugTaken) {
      return NextResponse.json(
        { error: "A form with this URL slug already exists." },
        { status: 409 },
      );
    }

    try {
      const form = await prisma.form.create({
        data: {
          slug: normalized.slug,
          title: normalized.title,
          description: normalized.description,
          themeId: normalized.themeId ?? "default",
          anonymous: normalized.anonymous ?? false,
          organizationId: actor.organizationId,
          ownerUserId: actor.id,
          questions: {
            create: normalized.questions.map((question) => ({
              ...(question.id ? { id: question.id } : {}),
              order: question.order,
              type: question.type,
              prompt: question.prompt,
              required: question.required,
              options: question.options as Prisma.InputJsonValue,
              visibility: question.visibility
                ? (question.visibility as Prisma.InputJsonValue)
                : Prisma.DbNull,
            })),
          },
        },
      });

      await upsertPublicFormRoute({
        organizationId: actor.organizationId,
        formId: form.id,
        slug: form.slug,
      });

      await mirrorFormRowToTenant(actor.schemaName, form).catch((error) => {
        console.error("Failed to mirror form into tenant schema:", error);
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
  } catch (error) {
    return authzResponse(error);
  }
}
