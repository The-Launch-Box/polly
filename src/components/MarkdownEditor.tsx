"use client";

import { useRef } from "react";

type MarkdownEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  error?: boolean;
  className?: string;
};

type SizeLevel = "body" | "subheading" | "heading";

/**
 * Lightweight markdown textarea with a formatting toolbar.
 * Stores markdown (bold/italic/headings); render with MarkdownContent.
 */
export function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  error,
  className = "",
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(before: string, after = before) {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${before}${after}`);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function applySize(level: SizeLevel) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = value.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = value.length;

    const line = value.slice(lineStart, lineEnd);
    const stripped = line.replace(/^#{1,3}\s+/, "");
    const prefix =
      level === "heading" ? "# " : level === "subheading" ? "## " : "";
    const nextLine = prefix + stripped;
    const next =
      value.slice(0, lineStart) + nextLine + value.slice(lineEnd);
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = lineStart + nextLine.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function currentSize(): SizeLevel {
    const el = textareaRef.current;
    const pos = el?.selectionStart ?? 0;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    let lineEnd = value.indexOf("\n", pos);
    if (lineEnd === -1) lineEnd = value.length;
    const line = value.slice(lineStart, lineEnd);
    if (/^###\s/.test(line) || /^##\s/.test(line)) return "subheading";
    if (/^#\s/.test(line)) return "heading";
    return "body";
  }

  const borderClass = error ? "border-red-300" : "border-zinc-300";

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-white ${borderClass} ${className}`}
    >
      <div
        className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5"
        role="toolbar"
        aria-label="Text formatting"
      >
        <ToolbarButton
          label="Bold"
          title="Bold"
          onClick={() => wrapSelection("**")}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          title="Italic"
          onClick={() => wrapSelection("*")}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-zinc-300" aria-hidden="true" />
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <span className="sr-only">Text size</span>
          <select
            value={currentSize()}
            onChange={(event) => applySize(event.target.value as SizeLevel)}
            onMouseDown={(event) => event.preventDefault()}
            className="rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-800 outline-none focus:border-zinc-400"
            aria-label="Text size"
          >
            <option value="body">Body</option>
            <option value="subheading">Subheading</option>
            <option value="heading">Heading</option>
          </select>
        </label>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full resize-y border-0 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
      />
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm text-zinc-700 transition hover:bg-zinc-200"
    >
      {children}
    </button>
  );
}
