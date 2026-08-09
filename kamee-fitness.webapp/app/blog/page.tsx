import type { Metadata } from "next";
import Link from "next/link";
import { ACCENTS } from "@/components/blog/accents";
import { BlogShell } from "@/components/blog/BlogShell";
import { PostCard } from "@/components/blog/PostCard";
import {
  getLatestPosts,
  getPillarIn,
  getPostsIn,
  getPublishedCategories,
  postUrl,
  SITE_BLOG_URL,
  topicPath,
} from "@/lib/blog/posts";

const TITLE = "Blog";
const DESCRIPTION =
  "Training, explained. Practical guides from the team behind Kamee Fitness — starting with every type of run, and growing from there.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: "/blog",
    siteName: "Kamee Fitness",
    title: `${TITLE} · Kamee Fitness`,
    description: DESCRIPTION,
    locale: "en_US",
    images: ["/adaptive-icon.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Kamee Fitness`,
    description: DESCRIPTION,
    images: ["/adaptive-icon.png"],
  },
};

export default function BlogIndexPage() {
  const categories = getPublishedCategories();
  const latest = getLatestPosts(6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Kamee Fitness Blog",
    url: SITE_BLOG_URL,
    description: DESCRIPTION,
    blogPost: latest.map((post) => ({
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
        {/* Hero */}
        <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-leaf-400/80">
          The Kamee Blog
        </p>
        <h1 className="font-display mt-4 max-w-3xl text-[clamp(2.2rem,6vw,3.4rem)] font-bold leading-[1.08] text-mist">
          Training, <span className="text-leaf-300">explained.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-300">
          Practical guides from the team behind Kamee Fitness. No hype, no
          jargon left undefined — just what each thing is, why it works, and how
          to actually do it.
        </p>

        {/* Topics */}
        <section className="mt-14">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-mist">
              Topics
            </h2>
            <span className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink-500">
              More on the way
            </span>
          </div>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {categories.map((category) => {
              const accent = ACCENTS[category.accent];
              const count = getPostsIn(category.id).length;
              const pillar = getPillarIn(category.id);
              return (
                <li key={category.id}>
                  <Link
                    href={topicPath(category.slug)}
                    className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white/[0.02] p-7 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.04] ${accent.ring} ${accent.hover}`}
                  >
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-[0.08] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.18] ${accent.glow}`}
                    />
                    <p
                      className={`text-[0.62rem] font-medium uppercase tracking-[0.2em] ${accent.label}`}
                    >
                      {count} {count === 1 ? "article" : "articles"}
                    </p>
                    <h3 className="font-display mt-3 text-2xl font-semibold text-mist group-hover:text-white">
                      {category.name}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-ink-200">
                      {category.tagline}
                    </p>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-400">
                      {category.blurb}
                    </p>
                    <p
                      className={`mt-5 inline-flex items-center gap-2 text-[0.62rem] font-medium uppercase tracking-[0.16em] ${accent.label}`}
                    >
                      {pillar ? "Start here" : "Browse"}
                      <span
                        aria-hidden
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </p>
                  </Link>
                </li>
              );
            })}

            {/* Honest placeholder so a single-topic blog still reads as a blog */}
            <li>
              <div className="flex h-full flex-col justify-center rounded-3xl border border-dashed border-white/10 p-7">
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.2em] text-ink-500">
                  Coming soon
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-400">
                  More topics are in the works — strength training, recovery,
                  and getting the most out of the app.
                </p>
              </div>
            </li>
          </ul>
        </section>

        {/* Latest */}
        <section className="mt-16">
          <h2 className="font-display text-xl font-semibold text-mist">
            Latest
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((post) => (
              <PostCard key={post.slug} post={post} showTopic />
            ))}
          </ul>
        </section>
      </div>
    </BlogShell>
  );
}
