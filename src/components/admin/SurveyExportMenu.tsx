"use client";

import { useEffect, useRef, useState } from "react";

export function SurveyExportMenu({ formSlug }: { formSlug: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Export results
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <a
            role="menuitem"
            href={`/api/admin/forms/${formSlug}/export?format=xlsx`}
            className="block px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            onClick={() => setOpen(false)}
          >
            Excel (.xlsx)
          </a>
          <a
            role="menuitem"
            href={`/api/admin/forms/${formSlug}/export?format=csv`}
            className="block px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            onClick={() => setOpen(false)}
          >
            CSV (.csv)
          </a>
        </div>
      )}
    </div>
  );
}
