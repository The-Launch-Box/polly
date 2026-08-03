"use client";

import { useRef, useState } from "react";

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

type HeadingLevel = "body" | "h1" | "h2" | "h3" | "h4";
type TextSize = "default" | "sm" | "lg" | "xl";

const HEADING_PREFIX: Record<Exclude<HeadingLevel, "body">, string> = {
  h1: "# ",
  h2: "## ",
  h3: "### ",
  h4: "#### ",
};

const SIZE_CLASS: Record<Exclude<TextSize, "default">, string> = {
  sm: "md-size-sm",
  lg: "md-size-lg",
  xl: "md-size-xl",
};

/**
 * Lightweight markdown textarea with a formatting toolbar.
 * Stores markdown (bold/italic/headings) plus optional size spans; render with MarkdownContent.
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
  const [, setSelectionTick] = useState(0);

  function refreshToolbar() {
    setSelectionTick((tick) => tick + 1);
  }

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
      refreshToolbar();
    });
  }

  function applyHeading(level: HeadingLevel) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = value.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = value.length;

    const line = value.slice(lineStart, lineEnd);
    const stripped = line.replace(/^#{1,6}\s+/, "");
    const prefix = level === "body" ? "" : HEADING_PREFIX[level];
    const nextLine = prefix + stripped;
    const next = value.slice(0, lineStart) + nextLine + value.slice(lineEnd);
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = lineStart + nextLine.length;
      el.setSelectionRange(cursor, cursor);
      refreshToolbar();
    });
  }

  function currentHeading(): HeadingLevel {
    const el = textareaRef.current;
    const pos = el?.selectionStart ?? 0;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    let lineEnd = value.indexOf("\n", pos);
    if (lineEnd === -1) lineEnd = value.length;
    const line = value.slice(lineStart, lineEnd);
    if (/^####\s/.test(line)) return "h4";
    if (/^###\s/.test(line)) return "h3";
    if (/^##\s/.test(line)) return "h2";
    if (/^#\s/.test(line)) return "h1";
    return "body";
  }

  function stripSizeSpans(text: string): string {
    return text.replace(
      /<span\s+class="md-size-(?:sm|lg|xl)">([\s\S]*?)<\/span>/g,
      "$1",
    );
  }

  function applyTextSize(size: TextSize) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const inner = stripSizeSpans(selected);
    const wrapped =
      size === "default"
        ? inner
        : `<span class="${SIZE_CLASS[size]}">${inner}</span>`;
    const next = value.slice(0, start) + wrapped + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start;
      const cursorEnd = start + wrapped.length;
      el.setSelectionRange(cursorStart, cursorEnd);
      refreshToolbar();
    });
  }

  function currentTextSize(): TextSize {
    const el = textareaRef.current;
    if (!el) return "default";
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const probe =
      selected ||
      value.slice(Math.max(0, start - 40), Math.min(value.length, end + 40));
    if (/class="md-size-xl"/.test(probe)) return "xl";
    if (/class="md-size-lg"/.test(probe)) return "lg";
    if (/class="md-size-sm"/.test(probe)) return "sm";
    return "default";
  }

  const borderClass = error ? "border-red-300" : "border-zinc-300";
  const selectClass =
    "rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-800 outline-none focus:border-zinc-400";

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
          <span className="ml-1 hidden text-xs sm:inline">Bold</span>
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          title="Italic"
          onClick={() => wrapSelection("_")}
        >
          <span className="italic">I</span>
          <span className="ml-1 hidden text-xs sm:inline">Italic</span>
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-zinc-300" aria-hidden="true" />

        <label className="flex items-center gap-1 text-xs text-zinc-600">
          <span className="whitespace-nowrap">Heading</span>
          <select
            value={currentHeading()}
            onChange={(event) =>
              applyHeading(event.target.value as HeadingLevel)
            }
            onMouseDown={(event) => event.preventDefault()}
            className={selectClass}
            aria-label="Heading level"
          >
            <option value="body">Paragraph</option>
            <option value="h1">H1 — largest</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
            <option value="h4">H4 — smallest</option>
          </select>
        </label>

        <span className="mx-1 h-4 w-px bg-zinc-300" aria-hidden="true" />

        <label className="flex items-center gap-1 text-xs text-zinc-600">
          <span className="whitespace-nowrap">Size</span>
          <select
            value={currentTextSize()}
            onChange={(event) =>
              applyTextSize(event.target.value as TextSize)
            }
            onMouseDown={(event) => event.preventDefault()}
            className={selectClass}
            aria-label="Text size"
          >
            <option value="default">Default</option>
            <option value="sm">Small</option>
            <option value="lg">Large</option>
            <option value="xl">Extra large</option>
          </select>
        </label>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onSelect={refreshToolbar}
        onKeyUp={refreshToolbar}
        onClick={refreshToolbar}
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
      className="flex h-7 items-center justify-center rounded px-2 text-sm text-zinc-700 transition hover:bg-zinc-200"
    >
      {children}
    </button>
  );
}
