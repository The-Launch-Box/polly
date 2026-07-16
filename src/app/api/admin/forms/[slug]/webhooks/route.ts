import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { slug } = await context.params;
  const form = await prisma.form.findUnique({ where: { slug } });
  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  const webhooks = await prisma.webhook.findMany({
    where: { formId: form.id },
    select: { id: true, name: true, url: true, includeAnswers: true, secret: true },
  });

  return NextResponse.json(webhooks);
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { slug } = await context.params;
  const form = await prisma.form.findUnique({ where: { slug } });
  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  let body: { name?: unknown; url?: unknown; includeAnswers?: unknown; secret?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const errors: Record<string, string> = {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.name = "Name is required.";

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    errors.url = "URL is required.";
  } else {
    try {
      new URL(url);
    } catch {
      errors.url = "URL must be a valid URL.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  const secret =
    typeof body.secret === "string" && body.secret.trim()
      ? body.secret.trim()
      : null;

  const webhook = await prisma.webhook.create({
    data: {
      formId: form.id,
      name,
      url,
      includeAnswers: Boolean(body.includeAnswers),
      secret,
    },
    select: { id: true, name: true, url: true, includeAnswers: true, secret: true },
  });

  return NextResponse.json(webhook, { status: 201 });
}
