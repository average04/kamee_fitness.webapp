/**
 * App-facing blog feed, derived from the post registry the same way
 * app/sitemap.ts derives its URLs. Served at /blog/feed.json (force-static);
 * the mobile app's "Tips for today" shelf fetches it. Keep this module free
 * of MDX imports (bodies.ts must stay out of this graph).
 */

// Relative imports: this module is under vitest, which has no "@/" alias.
import {
  CATEGORIES,
  POSTS,
  getCategoryById,
  postUrl,
  type AccentName,
  type Post,
} from "./posts";

export type FeedPost = {
  slug: string;
  url: string;
  title: string;
  excerpt: string;
  category: string;
  group: string | null;
  kind: "pillar" | "guide";
  effort: string | null;
  accent: AccentName;
  readingMinutes: number;
  published: string;
  updated: string | null;
};

export type BlogFeed = { posts: FeedPost[] };

function accentFor(post: Post): AccentName {
  const category = getCategoryById(post.category);
  if (post.group && category?.groups) {
    const group = category.groups.find((g) => g.name === post.group);
    if (group) return group.accent;
  }
  return category?.accent ?? "leaf";
}

export function buildBlogFeed(): BlogFeed {
  return {
    posts: POSTS.map((post) => ({
      slug: post.slug,
      url: postUrl(post.slug),
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      group: post.group ?? null,
      kind: post.kind,
      effort: post.effort ?? null,
      accent: accentFor(post),
      readingMinutes: post.readingMinutes,
      published: post.published,
      updated: post.updated ?? null,
    })),
  };
}
