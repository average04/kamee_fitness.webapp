import type { MDXComponents } from "mdx/types";

// Turbopack (Next 16) doesn't run remark/rehype plugins, so we derive heading
// IDs from the heading text at render time. Children must be a plain string —
// any markdown formatting inside a heading (bold, em, links) would break this.
function slugifyHeading(children: React.ReactNode): string | undefined {
  if (typeof children !== "string") return undefined;
  return children
    .toLowerCase()
    .replace(/^[\d.]+\s*/, "") // strip leading "1. ", "12. ", etc.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Map MDX elements to Tailwind-styled React components. Tokens (ink/leaf/ember)
// are defined in app/globals.css.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="text-3xl font-bold text-leaf-300 mt-8 mb-4">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2
        id={slugifyHeading(children)}
        className="text-2xl font-semibold text-leaf-400 mt-10 mb-3 scroll-mt-24"
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        id={slugifyHeading(children)}
        className="text-lg font-semibold text-ink-100 mt-6 mb-2"
      >
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="text-ink-200 leading-relaxed my-3">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-6 my-3 text-ink-200 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 my-3 text-ink-200 space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ children, href }) => (
      <a
        href={href}
        className="text-leaf-400 underline underline-offset-2 hover:text-leaf-300"
      >
        {children}
      </a>
    ),
    strong: ({ children }) => <strong className="text-ink-50 font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse border border-ink-700">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="text-left p-2 border border-ink-700 bg-ink-800 font-semibold text-ink-50">{children}</th>
    ),
    td: ({ children }) => <td className="p-2 border border-ink-700 align-top text-ink-200">{children}</td>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-ember-600 pl-4 italic my-4 text-ink-100">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-ink-700 my-8" />,
    code: ({ children }) => (
      <code className="bg-ink-800 text-leaf-300 px-1 py-0.5 rounded text-sm">{children}</code>
    ),
  };
}
