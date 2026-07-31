import { NextResponse } from "next/server";
import { deleteSubmissionAttachments } from "@/lib/attachments";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  AuthzError,
  groupIdsForUser,
  loadFormAuthzContext,
  requireActor,
} from "@/lib/session";

type RouteContext = {
  params: Promise<{ slug: string; submissionId: string }>;
};

function authzResponse(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug, submissionId } = await context.params;
    const form = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:delete_responses", form, groupIds)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, formId: form.id },
      select: { id: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Response not found." }, { status: 404 });
    }

    await prisma.submission.delete({ where: { id: submission.id } });
    await deleteSubmissionAttachments(submission.id).catch((error) => {
      console.error("Failed to delete submission attachments:", error);
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthzError) {
      return authzResponse(error);
    }

    console.error("Submission delete failed:", error);
    return NextResponse.json(
      { error: "Could not delete response." },
      { status: 500 },
    );
  }
}
