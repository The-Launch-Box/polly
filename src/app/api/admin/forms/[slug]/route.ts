import { NextResponse } from "next/server";
import { can } from "@/lib/authz";
import {
  normalizeFormInput,
  validateFormInput,
  type UpdateFormInput,
} from "@/lib/form-create";
import { deletePublicFormRoute, upsertPublicFormRoute } from "@/lib/form-routes";
import { FormUpdateError, updateFormBySlug } from "@/lib/form-update";
import { prisma } from "@/lib/prisma";
import {
  AuthzError,
  groupIdsForUser,
  loadFormAuthzContext,
  requireActor,
} from "@/lib/session";
import {
  deleteFormRowFromTenant,
  mirrorFormRowToTenant,
} from "@/lib/tenant-pg";
import type { QuestionOptions, QuestionVisibility } from "@/lib/types";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function authzResponse(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug } = await context.params;
    const form = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:view", form, groupIds)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const full = await prisma.form.findFirst({
      where: { slug, organizationId: actor.organizationId },
      include: {
        questions: { orderBy: { order: "asc" } },
        _count: { select: { submissions: true } },
      },
    });

    if (!full) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    return NextResponse.json({
      slug: full.slug,
      title: full.title,
      description: full.description,
      themeId: full.themeId,
      anonymous: full.anonymous,
      submissionCount: full._count.submissions,
      questions: full.questions.map((question) => ({
        id: question.id,
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        required: question.required,
        options: question.options as QuestionOptions,
        visibility: question.visibility as QuestionVisibility | null,
      })),
    });
  } catch (error) {
    return authzResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug } = await context.params;
    const existing = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:edit", existing, groupIds)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

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

    if (normalized.slug !== slug) {
      const slugTaken = await prisma.publicFormRoute.findUnique({
        where: { slug: normalized.slug },
      });
      if (slugTaken && slugTaken.formId !== existing.id) {
        return NextResponse.json(
          { error: "A form with this URL slug already exists." },
          { status: 409 },
        );
      }
    }

    const form = await updateFormBySlug(slug, normalized, actor.organizationId);

    if (form) {
      await upsertPublicFormRoute({
        organizationId: actor.organizationId,
        formId: form.id,
        slug: form.slug,
        previousSlug: slug,
      });
      await mirrorFormRowToTenant(actor.schemaName, {
        ...form,
        organizationId: actor.organizationId,
      }).catch((error) => {
        console.error("Failed to mirror form into tenant schema:", error);
      });
    }

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

    if (error instanceof AuthzError) {
      return authzResponse(error);
    }

    console.error("Form update failed:", error);
    return NextResponse.json(
      { error: "Could not save changes." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug } = await context.params;
    const existing = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:edit", existing, groupIds)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await deletePublicFormRoute(existing.id);
    await prisma.form.delete({ where: { id: existing.id } });
    await deleteFormRowFromTenant(actor.schemaName, existing.id).catch(
      (error) => {
        console.error("Failed to delete form from tenant schema:", error);
      },
    );

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthzError) {
      return authzResponse(error);
    }

    console.error("Form delete failed:", error);
    return NextResponse.json(
      { error: "Could not delete survey." },
      { status: 500 },
    );
  }
}
