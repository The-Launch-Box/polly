import type { AttachmentKind, AttachmentOptions } from "@/lib/types";

const DEFAULT_MAX_SIZE_MB = 25;
const DEFAULT_ALLOWED_KINDS: AttachmentKind[] = ["image", "video", "document"];

export function getAttachmentAllowedKinds(options: AttachmentOptions | null | undefined) {
  return options?.allowedKinds?.length ? options.allowedKinds : DEFAULT_ALLOWED_KINDS;
}

export function getAttachmentMaxBytes(options: AttachmentOptions | null | undefined) {
  const maxSizeMb = options?.maxSizeMb ?? DEFAULT_MAX_SIZE_MB;
  return Math.max(1, Math.floor(maxSizeMb)) * 1024 * 1024;
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  const kb = sizeBytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function getAcceptAttribute(options: AttachmentOptions | null | undefined) {
  const allowedKinds = getAttachmentAllowedKinds(options);
  return allowedKinds
    .flatMap((kind) => {
      switch (kind) {
        case "image":
          return ["image/*"];
        case "video":
          return ["video/*"];
        case "document":
          return [
            ".pdf",
            ".doc",
            ".docx",
            ".ppt",
            ".pptx",
            ".xls",
            ".xlsx",
            ".txt",
            ".rtf",
          ];
        default:
          return [];
      }
    })
    .join(",");
}

export function getAttachmentKindForMimeType(mimeType: string): AttachmentKind | null {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("application/msword") ||
    mimeType.startsWith("application/vnd.openxmlformats-officedocument") ||
    mimeType.startsWith("application/vnd.ms-") ||
    mimeType.startsWith("text/")
  ) {
    return "document";
  }
  return null;
}

export function getAttachmentKindForFilename(filename: string): AttachmentKind | null {
  const parts = filename.toLowerCase().split(".");
  const extension = parts.length > 1 ? `.${parts.at(-1)}` : "";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(extension)) {
    return "image";
  }
  if ([".mp4", ".mov", ".avi", ".webm", ".mkv"].includes(extension)) {
    return "video";
  }
  if (
    [
      ".pdf",
      ".doc",
      ".docx",
      ".ppt",
      ".pptx",
      ".xls",
      ".xlsx",
      ".txt",
      ".rtf",
    ].includes(extension)
  ) {
    return "document";
  }
  return null;
}

export function validateAttachmentFile(
  file: File,
  options: AttachmentOptions | null | undefined,
): string | null {
  if (!(file instanceof File)) {
    return "A file upload is required.";
  }
  if (file.size <= 0) {
    return "Uploaded files cannot be empty.";
  }
  if (file.size > getAttachmentMaxBytes(options)) {
    return `File must be ${options?.maxSizeMb ?? DEFAULT_MAX_SIZE_MB} MB or smaller.`;
  }

  const allowedKinds = getAttachmentAllowedKinds(options);
  const kind =
    getAttachmentKindForMimeType(file.type) ?? getAttachmentKindForFilename(file.name);
  if (!kind || !allowedKinds.includes(kind)) {
    const labels = allowedKinds.join(", ");
    return `Allowed file types: ${labels}.`;
  }

  return null;
}
