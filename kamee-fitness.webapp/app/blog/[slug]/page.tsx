import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostLayout } from "@/components/blog/PostLayout";
import { BODIES } from "@/lib/blog/bodies";
import { getAdjacent, getPost, POST_SLUGS } from "@/lib/blog/posts";

// Every post is known at build time; anything else is a static 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return POST_SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found" };

  const url = `/blog/${post.slug}`;
  // openGraph/twitter are restated in full — Next merges metadata shallowly
  // per key, so a partial object would drop the root layout's fields.
  // `images` is deliberately omitted so the opengraph-image.tsx file
  // convention supplies it.
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "Kamee Fitness",
      title: post.title,
      description: post.description,
      publishedTime: post.published,
      modifiedTime: post.updated ?? post.published,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const Body = BODIES[post.slug];
  const { prev, next } = getAdjacent(post.slug);

  return (
    <PostLayout post={post} prev={prev} next={next}>
      <Body />
    </PostLayout>
  );
}
