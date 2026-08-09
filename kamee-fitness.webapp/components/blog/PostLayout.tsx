import Link from "next/link";
import { StoreBadge } from "@/components/landing/StoreBadges";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing/stores";
import { postUrl, type RunPost } from "@/lib/blog/posts";

type Props = {
  post: RunPost;
  prev: RunPost | null;
  next: RunPost | null;
  children: React.ReactNode;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function PostLayout({ post, prev, next, children }: Props) {
  const dateLabel = post.updated
    ? `Updated ${formatDate(post.updated)}`
    : formatDate(post.published);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.updated ?? post.published,
    author: { "@type": "Organization", name: "Kamee Fitness" },
    publisher: { "@type": "Organization", name: "Kamee Fitness" },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl(post.slug) },
  };

  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-leaf-400"
        >
          ← All running guides
        </Link>

        <header className="mt-6">
          {post.group && (
            <span className="rounded-full border border-leaf-500/40 bg-leaf-500/[0.07] px-3 py-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-leaf-300">
              {post.group}
            </span>
          )}
          <h1 className="font-display mt-4 text-4xl font-bold text-leaf-300 lg:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-ink-300">{post.description}</p>
          <p className="mt-4 text-sm text-ink-400">
            {dateLabel} · {post.readingMinutes} min read
            {post.effort ? ` · ${post.effort} effort` : ""}
          </p>
        </header>

        <article className="mt-10 max-w-[72ch]">{children}</article>

        {/* App CTA */}
        <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="font-display text-lg font-semibold text-mist">
            Run it with Kamee
          </p>
          <p className="mt-2 text-sm text-ink-300">
            Track the session with GPS, watch your pace live, and review your
            splits afterwards. Free on iOS and Android.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StoreBadge platform="ios" href={APP_STORE_URL} />
            <StoreBadge platform="android" href={PLAY_STORE_URL} />
          </div>
        </section>

        {(prev || next) && (
          <nav className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
            {prev ? (
              <Link
                href={`/blog/${prev.slug}`}
                className="text-sm text-ink-300 hover:text-leaf-400"
              >
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/blog/${next.slug}`}
                className="text-sm text-ink-300 hover:text-leaf-400 sm:text-right"
              >
                {next.title} →
              </Link>
            )}
          </nav>
        )}

        <p className="mt-10 border-t border-white/10 pt-6 text-xs text-ink-500">
          General training information, not medical advice. Check with a doctor
          before starting or changing a training plan, especially if you have an
          existing condition or injury.
        </p>
      </div>
    </main>
  );
}
