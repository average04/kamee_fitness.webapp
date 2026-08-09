import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ACCENTS } from "@/components/blog/accents";
import { BlogShell } from "@/components/blog/BlogShell";
import { PostCard } from "@/components/blog/PostCard";
import {
  CATEGORIES,
  getCategory,
  getGuidesIn,
  getGuidesInGroup,
  getPillarIn,
  postUrl,
  topicPath,
} from "@/lib/blog/posts";

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ topic: c.slug }));
}

type Props = { params: Promise<{ topic: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const category = getCategory(topic);
  if (!category) return { title: "Topic not found" };

  const title = `${category.name} — ${category.tagline}`;
  const url = topicPath(category.slug);
  return {
    title,
    description: category.blurb,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "Kamee Fitness",
      title: `${title} · Kamee Fitness`,
      description: category.blurb,
      locale: "en_US",
      images: ["/adaptive-icon.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Kamee Fitness`,
      description: category.blurb,
      images: ["/adaptive-icon.png"],
    },
  };
}

export default async function TopicPage({ params }: Props) {
  const { topic } = await params;
  const category = getCategory(topic);
  if (!category) notFound();

  const accent = ACCENTS[category.accent];
  const pillar = getPillarIn(category.id);
  const guides = getGuidesIn(category.id);
  // Anything whose group isn't declared on the category still needs a home.
  const grouped = new Set(
    (category.groups ?? []).flatMap((g) =>
      getGuidesInGroup(category.id, g.name).map((p) => p.slug),
    ),
  );
  const ungrouped = guides.filter((p) => !grouped.has(p.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} — ${category.tagline}`,
    description: category.blurb,
    hasPart: guides.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: postUrl(post.slug),
      datePublished: post.published,
    })),
  };

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-5xl px-6 pb-10 pt-14 lg:pt-20">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-ink-400 transition-colors hover:text-leaf-400"
        >
          ← All topics
        </Link>

        {/* Topic hero */}
        <p
          className={`mt-6 text-[0.62rem] font-medium uppercase tracking-[0.22em] ${accent.label}`}
        >
          {category.name}
        </p>
        <h1 className="font-display mt-4 max-w-3xl text-[clamp(2.2rem,6vw,3.4rem)] font-bold leading-[1.08] text-mist">
          {category.tagline}
          <span className={accent.label}>.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-300">
          {category.blurb}
        </p>
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink-500">
          <span>{guides.length} guides</span>
          <span aria-hidden>·</span>
          <span>No jargon</span>
          <span aria-hidden>·</span>
          <span>Free</span>
        </p>

        {/* Pillar */}
        {pillar && (
          <Link
            href={`/blog/${pillar.slug}`}
            className={`group relative mt-12 block overflow-hidden rounded-3xl border bg-white/[0.02] p-7 transition-colors sm:p-9 ${accent.ring} ${accent.hover}`}
          >
            <span
              aria-hidden
              className={`pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-[0.09] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.16] ${accent.glow}`}
            />
            <p
              className={`text-[0.62rem] font-medium uppercase tracking-[0.2em] ${accent.label}`}
            >
              Start here
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-2xl font-semibold leading-snug text-mist group-hover:text-white sm:text-3xl">
              {pillar.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-300">
              {pillar.excerpt}
            </p>
            <p
              className={`mt-5 inline-flex items-center gap-2 text-[0.62rem] font-medium uppercase tracking-[0.16em] ${accent.label}`}
            >
              Read the overview
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
              <span className="text-ink-500">
                · {pillar.readingMinutes} min
              </span>
            </p>
          </Link>
        )}

        {/* Groups */}
        {(category.groups ?? []).map((group) => {
          const groupAccent = ACCENTS[group.accent];
          const posts = getGuidesInGroup(category.id, group.name);
          if (posts.length === 0) return null;
          return (
            <section key={group.name} className="mt-14">
              <div className="flex items-baseline gap-3">
                <h2
                  className={`font-display text-xl font-semibold ${groupAccent.label}`}
                >
                  {group.name}
                </h2>
                <span className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink-500">
                  {posts.length} guides
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm text-ink-400">
                {group.blurb}
              </p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </ul>
            </section>
          );
        })}

        {ungrouped.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-xl font-semibold text-mist">
              More in {category.name}
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ungrouped.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </BlogShell>
  );
}
