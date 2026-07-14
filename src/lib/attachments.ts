import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AttachmentAnswer } from "@/lib/types";
import "server-only";

function projectRoot() {
  return process.cwd();
}

export function getAttachmentsRoot() {
  if (process.env.ATTACHMENTS_DIR?.trim()) {
    return process.env.ATTACHMENTS_DIR.trim();
  }
  // Containers often run as a non-root user that cannot create /app/.uploads.
  if (process.env.NODE_ENV === "production") {
    return path.join("/tmp", "polly-uploads");
  }
  return path.join(projectRoot(), ".uploads");
}

function safeExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return extension.replace(/[^a-z0-9.]/g, "").slice(0, 16);
}

function safeFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  const cleaned = normalized.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return cleaned.slice(0, 120) || "attachment";
}

export async function saveAttachmentFile({
  submissionId,
  questionId,
  file,
}: {
  submissionId: string;
  questionId: string;
  file: File;
}): Promise<AttachmentAnswer> {
  const root = getAttachmentsRoot();
  const directory = path.join(root, submissionId, questionId);
  await mkdir(directory, { recursive: true });

  const extension = safeExtension(file.name);
  const basename = `${randomUUID()}${extension}`;
  const absolutePath = path.join(directory, basename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    filename: safeFilename(file.name),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    downloadUrl: `/api/attachments/${submissionId}/${questionId}/${basename}`,
  };
}

export async function readAttachmentFile(
  submissionId: string,
  questionId: string,
  filename: string,
) {
  const absolutePath = path.join(getAttachmentsRoot(), submissionId, questionId, filename);
  const [buffer, info] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
  return { buffer, sizeBytes: info.size };
}
