import ReactMarkdown from "react-markdown";

type MarkdownContentProps = {
  content: string;
  className?: string;
  /** Use survey theme CSS variables instead of admin zinc colors. */
  themed?: boolean;
};

/**
 * Renders markdown descriptions safely (no raw HTML).
 * Supports bold, italic, and headings used by MarkdownEditor.
 */
export function MarkdownContent({
  content,
  className = "",
  themed = false,
}: MarkdownContentProps) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const muted = themed ? "var(--theme-text-muted)" : undefined;
  const text = themed ? "var(--theme-text)" : undefined;

  return (
    <div
      className={`markdown-content space-y-2 text-sm leading-relaxed ${className}`}
      style={themed ? { color: muted } : { color: "#52525b" }}
    >
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="leading-relaxed" style={themed ? { color: muted } : undefined}>
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong
              className="font-semibold"
              style={themed ? { color: text } : { color: "#18181b" }}
            >
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => (
            <h1
              className="text-xl font-semibold leading-snug sm:text-2xl"
              style={themed ? { color: text } : { color: "#18181b" }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className="text-lg font-semibold leading-snug sm:text-xl"
              style={themed ? { color: text } : { color: "#18181b" }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className="text-base font-semibold leading-snug sm:text-lg"
              style={themed ? { color: text } : { color: "#18181b" }}
            >
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
              style={themed ? { color: "var(--theme-primary)" } : undefined}
            >
              {children}
            </a>
          ),
        }}
      >
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
