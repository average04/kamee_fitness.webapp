import type { Metadata } from "next";
import Link from "next/link";
import { GROUP_ACCENT } from "@/components/blog/accents";
import { BlogShell } from "@/components/blog/BlogShell";
import { PostCard } from "@/components/blog/PostCard";
import {
  GROUP_BLURBS,
  getGuides,
  getGuidesByGroup,
  getPillar,
  POST_GROUPS,
  postUrl,
} from "@/lib/blog/posts";

const TITLE = "Running Guides";
const DESCRIPTION =
  "Every type of running workout explained — easy, tempo, interval, long, fartlek, hills and more. What each does, how hard it should feel, and how to run it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: "/blog",
    siteName: "Kamee Fitness",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: ["/adaptive-icon.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/adaptive-icon.png"],
  },
};

export default function BlogIndexPage() {
  const pillar = getPillar();
  const guides = getGuides();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    itemListElement: guides.map((post, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: postUrl(post.slug),
      name: post.title,
    })),
  };

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-5xl px-6 pb-8 pt-14 lg:pt-20">
        {/* Page hero */}
        <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-leaf-400/80">
          Kamee Guides
        </p>
        <h1 className="font-display mt-4 max-w-3xl text-[clamp(2.2rem,6vw,3.4rem)] font-bold leading-[1.08] text-mist">
          Every type of run,{" "}
          <span className="text-leaf-300">explained.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-300">
          {DESCRIPTION}
        </p>
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink-500">
          <span>{guides.length} guides</span>
          <span aria-hidden>·</span>
          <span>No jargon</span>
          <span aria-hidden>·</span>
          <span>Free</span>
        </p>

        {/* Featured pillar */}
        <Link
          href={`/blog/${pillar.slug}`}
          className="group relative mt-12 block overflow-hidden rounded-3xl border border-leaf-500/25 bg-leaf-500/[0.04] p-7 transition-colors hover:border-leaf-500/50 sm:p-9"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-leaf-500 opacity-[0.09] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.16]"
          />
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.2em] text-leaf-400">
            Start here
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-2xl font-semibold leading-snug text-mist group-hover:text-white sm:text-3xl">
            {pillar.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-300">
            {pillar.excerpt}
          </p>
          <p className="mt-5 inline-flex items-center gap-2 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-leaf-300">
            Read the overview
            <span
              aria-hidden
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
            <span className="text-ink-500">· {pillar.readingMinutes} min</span>
          </p>
        </Link>

        {/* Guides by group */}
        {POST_GROUPS.map((group) => {
          const accent = GROUP_ACCENT[group];
          const posts = getGuidesByGroup(group);
          return (
            <section key={group} className="mt-14">
              <div className="flex items-baseline gap-3">
                <h2
                  className={`font-display text-xl font-semibold ${accent.label}`}
                >
                  {group}
                </h2>
                <span className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink-500">
                  {posts.length} guides
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm text-ink-400">
                {GROUP_BLURBS[group]}
              </p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </BlogShell>
  );
}
