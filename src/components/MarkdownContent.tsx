import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

type MarkdownContentProps = {
  content: string;
  className?: string;
  /** Use survey theme CSS variables instead of admin zinc colors. */
  themed?: boolean;
};

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "span"],
  attributes: {
    ...defaultSchema.attributes,
    span: ["className", "class"],
  },
};

const SIZE_CLASS_MAP: Record<string, string> = {
  "md-size-sm": "text-xs sm:text-sm",
  "md-size-lg": "text-base sm:text-lg",
  "md-size-xl": "text-lg sm:text-xl",
};

/**
 * Renders markdown descriptions safely (limited HTML for text-size spans).
 * Supports bold, italic, H1–H4, and Small/Large/XL size wrappers from MarkdownEditor.
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
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          p: ({ children }) => (
            <p
              className="leading-relaxed"
              style={themed ? { color: muted } : undefined}
            >
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
              className="text-2xl font-semibold leading-snug sm:text-3xl"
              style={themed ? { color: text } : { color: "#18181b" }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className="text-xl font-semibold leading-snug sm:text-2xl"
              style={themed ? { color: text } : { color: "#18181b" }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className="text-lg font-semibold leading-snug sm:text-xl"
              style={themed ? { color: text } : { color: "#18181b" }}
            >
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4
              className="text-base font-semibold leading-snug sm:text-lg"
              style={themed ? { color: text } : { color: "#18181b" }}
            >
              {children}
            </h4>
          ),
          span: ({ className: spanClass, children }) => {
            const sizeClass =
              typeof spanClass === "string"
                ? spanClass
                    .split(/\s+/)
                    .map((token) => SIZE_CLASS_MAP[token])
                    .filter(Boolean)
                    .join(" ")
                : "";
            if (!sizeClass) {
              return <span>{children}</span>;
            }
            return <span className={sizeClass}>{children}</span>;
          },
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
