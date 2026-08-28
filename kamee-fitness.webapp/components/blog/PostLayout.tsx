import Link from "next/link";
import { ACCENTS, DEFAULT_ACCENT } from "./accents";
import { BlogShell } from "./BlogShell";
import { StoreBadges } from "@/components/landing/StoreBadges";
import {
  getCategoryById,
  postUrl,
  topicPath,
  type Post,
} from "@/lib/blog/posts";

type Props = {
  post: Post;
  prev: Post | null;
  next: Post | null;
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
  const isPillar = post.kind === "pillar";
  const category = getCategoryById(post.category);
  const group = category?.groups?.find((g) => g.name === post.group);
  const accent = ACCENTS[group?.accent ?? category?.accent ?? "leaf"] ?? DEFAULT_ACCENT;

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
    articleSection: category?.name,
    author: { "@type": "Organization", name: "Kamee Fitness" },
    publisher: { "@type": "Organization", name: "Kamee Fitness" },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl(post.slug) },
  };

  const content = (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        {/* Breadcrumb back into the topic, not to a generic index. */}
        <nav className="flex flex-wrap items-center gap-2 text-sm text-ink-400">
          <Link href="/blog" className="transition-colors hover:text-leaf-400">
            Blog
          </Link>
          {category && (
            <>
              <span aria-hidden className="text-ink-500">
                /
              </span>
              <Link
                href={topicPath(category.slug)}
                className="transition-colors hover:text-leaf-400"
              >
                {category.name}
              </Link>
            </>
          )}
        </nav>

        <header className="mt-6">
          {post.group && (
            <span
              className={`rounded-full border px-3 py-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] ${accent.pill}`}
            >
              {post.group}
            </span>
          )}
          <h1 className="font-display mt-4 text-[clamp(2rem,5.5vw,3rem)] font-bold leading-[1.1] text-leaf-300">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-300">
            {post.description}
          </p>
          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink-500">
            <span>{dateLabel}</span>
            <span aria-hidden>·</span>
            <span>{post.readingMinutes} min read</span>
            {post.effort && (
              <>
                <span aria-hidden>·</span>
                <span>{post.effort} effort</span>
              </>
            )}
          </p>
        </header>

        <article className="mt-10 max-w-[72ch]">{children}</article>

        {/* The pillar renders inside BlogShell, whose footer already carries
            the store CTA — a second one here would just repeat it. */}
        {!isPillar && (
          <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="font-display text-lg font-semibold text-mist">
              Run it with Kamee
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">
              Track the session with GPS, watch your pace live, and review your
              splits afterwards. Free on iOS and Android.
            </p>
            <StoreBadges placement="blog-post" className="mt-4" />
          </section>
        )}

        {(prev || next) && (
          <nav className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
            {prev ? (
              <Link
                href={`/blog/${prev.slug}`}
                className="text-sm text-ink-300 transition-colors hover:text-leaf-400"
              >
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/blog/${next.slug}`}
                className="text-sm text-ink-300 transition-colors hover:text-leaf-400 sm:text-right"
              >
                {next.title} →
              </Link>
            )}
          </nav>
        )}

        {category && (
          <p className="mt-10 text-sm text-ink-400">
            More in{" "}
            <Link
              href={topicPath(category.slug)}
              className={`underline underline-offset-2 ${accent.label}`}
            >
              {category.name}
            </Link>
          </p>
        )}

        <p className="mt-8 border-t border-white/10 pt-6 text-xs leading-relaxed text-ink-500">
          General training information, not medical advice. Check with a doctor
          before starting or changing a training plan, especially if you have an
          existing condition or injury.
        </p>
      </div>
    </>
  );

  // Entry points wear the site chrome; individual guides stay a plain reading
  // page so the article is the whole screen.
  if (isPillar) return <BlogShell>{content}</BlogShell>;

  return <main className="min-h-screen bg-ink-950 text-ink-100">{content}</main>;
}
