import { NextResponse } from "next/server";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  AuthzError,
  groupIdsForUser,
  loadFormAuthzContext,
  requireActor,
} from "@/lib/session";

type RouteContext = { params: Promise<{ slug: string; id: string }> };

function authzResponse(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug, id } = await context.params;
    const form = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:manage_webhooks", form, groupIds)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const existing = await prisma.webhook.findFirst({ where: { id, formId: form.id } });
    if (!existing) {
      return NextResponse.json({ error: "Webhook not found." }, { status: 404 });
    }

    let body: { name?: unknown; url?: unknown; includeAnswers?: unknown; secret?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const errors: Record<string, string> = {};

    const name =
      body.name !== undefined
        ? typeof body.name === "string"
          ? body.name.trim()
          : ""
        : undefined;
    if (name !== undefined && !name) errors.name = "Name is required.";

    const url =
      body.url !== undefined
        ? typeof body.url === "string"
          ? body.url.trim()
          : ""
        : undefined;
    if (url !== undefined) {
      if (!url) {
        errors.url = "URL is required.";
      } else {
        try {
          new URL(url);
        } catch {
          errors.url = "URL must be a valid URL.";
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
    }

    const secret =
      body.secret !== undefined
        ? typeof body.secret === "string" && body.secret.trim()
          ? body.secret.trim()
          : null
        : undefined;

    const webhook = await prisma.webhook.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(body.includeAnswers !== undefined && {
          includeAnswers: Boolean(body.includeAnswers),
        }),
        ...(secret !== undefined && { secret }),
      },
      select: { id: true, name: true, url: true, includeAnswers: true, secret: true },
    });

    return NextResponse.json(webhook);
  } catch (error) {
    return authzResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug, id } = await context.params;
    const form = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:manage_webhooks", form, groupIds)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const existing = await prisma.webhook.findFirst({ where: { id, formId: form.id } });
    if (!existing) {
      return NextResponse.json({ error: "Webhook not found." }, { status: 404 });
    }

    await prisma.webhook.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return authzResponse(error);
  }
}
