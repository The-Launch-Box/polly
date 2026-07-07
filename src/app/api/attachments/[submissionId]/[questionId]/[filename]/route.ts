import { basename } from "node:path";
import { auth } from "@/auth";
import { readAttachmentFile } from "@/lib/attachments";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    submissionId: string;
    questionId: string;
    filename: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized.", { status: 401 });
  }

  const { submissionId, questionId, filename } = await context.params;

  try {
    const { buffer } = await readAttachmentFile(
      submissionId,
      questionId,
      basename(filename),
    );

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `inline; filename="${basename(filename)}"`,
      },
    });
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
