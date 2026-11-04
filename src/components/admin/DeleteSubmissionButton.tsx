"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteSubmissionButtonProps = {
  formSlug: string;
  submissionId: string;
};

export function DeleteSubmissionButton({
  formSlug,
  submissionId,
}: DeleteSubmissionButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this response permanently? This cannot be undone.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/forms/${formSlug}/submissions/${submissionId}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        window.alert(data?.error ?? "Could not delete response.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Could not delete response.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={isDeleting}
      className="rounded border border-negative/40 px-2.5 py-1 text-xs font-medium text-negative transition hover:border-negative hover:bg-negative-dim disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isDeleting ? "Deleting…" : "Delete"}
    </button>
  );
}
