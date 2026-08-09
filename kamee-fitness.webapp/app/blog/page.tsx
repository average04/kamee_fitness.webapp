import type { Metadata } from "next";
import Link from "next/link";
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    itemListElement: getGuides().map((post, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: postUrl(post.slug),
      name: post.title,
    })),
  };

  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-leaf-400"
        >
          ← Kamee Fitness
        </Link>

        <h1 className="font-display mt-6 text-4xl font-bold text-leaf-300 lg:text-5xl">
          {TITLE}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-300">{DESCRIPTION}</p>

        {/* Featured pillar */}
        <Link
          href={`/blog/${pillar.slug}`}
          className="group mt-10 block rounded-3xl border border-leaf-500/30 bg-leaf-500/[0.05] p-6 transition-colors hover:border-leaf-500/60"
        >
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-leaf-400">
            Start here
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-mist group-hover:text-leaf-300">
            {pillar.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">{pillar.excerpt}</p>
          <p className="mt-3 text-[0.62rem] uppercase tracking-[0.16em] text-ink-400">
            {pillar.readingMinutes} min read
          </p>
        </Link>

        {POST_GROUPS.map((group) => (
          <section key={group} className="mt-12">
            <h2 className="font-display text-xl font-semibold text-leaf-400">
              {group}
            </h2>
            <p className="mt-1 text-sm text-ink-400">{GROUP_BLURBS[group]}</p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {getGuidesByGroup(group).map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
