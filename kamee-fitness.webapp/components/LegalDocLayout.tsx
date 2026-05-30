import { LAST_UPDATED } from "@/lib/legal-version";

type Section = { id: string; label: string };

type Props = {
  title: string;
  sections: Section[];
  children: React.ReactNode;
};

export function LegalDocLayout({ title, sections, children }: Props) {
  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <div className="max-w-5xl mx-auto px-6 py-12 lg:py-16">
        <header className="mb-10">
          <a
            href="/"
            className="text-sm text-ink-400 hover:text-leaf-400 inline-flex items-center gap-1"
          >
            ← Kamee Fitness
          </a>
          <h1 className="text-4xl lg:text-5xl font-bold text-leaf-300 mt-4">
            {title}
          </h1>
          <p className="text-sm text-ink-400 mt-3">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="lg:flex lg:gap-12">
          {/* Sticky TOC, desktop only */}
          <nav
            aria-label="Table of contents"
            className="hidden lg:block lg:w-56 lg:flex-shrink-0"
          >
            <div className="sticky top-8">
              <p className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-3">
                Contents
              </p>
              <ol className="space-y-2 text-sm text-ink-300">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="hover:text-leaf-400">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="flex-1 min-w-0 max-w-[72ch]">{children}</article>
        </div>

        <footer className="mt-16 pt-6 border-t border-ink-700 text-xs text-ink-500">
          Questions? Email{" "}
          <a
            href="mailto:bayogjayr@gmail.com"
            className="text-leaf-400 underline"
          >
            bayogjayr@gmail.com
          </a>
          .
        </footer>
      </div>

      {/* Print styles: hide chrome, expand text, ensure black-on-white. */}
      <style>{`
        @media print {
          nav[aria-label="Table of contents"] { display: none; }
          header a { display: none; }
          main { background: white !important; color: black !important; }
          h1, h2, h3, p, li, td, th { color: black !important; }
        }
      `}</style>
    </main>
  );
}
