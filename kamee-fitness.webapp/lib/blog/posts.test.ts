import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  getAdjacent,
  getCategory,
  getCategoryById,
  getGuidesIn,
  getLatestPosts,
  getPillarIn,
  getPost,
  getPostsIn,
  getPublishedCategories,
  POSTS,
  POST_SLUGS,
  postUrl,
  topicPath,
  topicUrl,
} from "./posts";

const PLACEHOLDER = /\b(tbd|todo|lorem|placeholder|xxx)\b/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BLOG_DIR = path.join(process.cwd(), "content", "blog");

/** Route segments that live under /blog and would shadow a post slug. */
const RESERVED_SEGMENTS = ["topics"];

function mdxFiles(): string[] {
  try {
    return readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
}

function wordCount(src: string): number {
  return src
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_>|`]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

describe("POST_SLUGS", () => {
  it("has 16 unique kebab-case slugs", () => {
    expect(POST_SLUGS).toHaveLength(16);
    expect(new Set(POST_SLUGS).size).toBe(16);
    for (const slug of POST_SLUGS) expect(slug).toMatch(SLUG_RE);
  });

  it("matches the registry one-for-one", () => {
    expect(POSTS.map((p) => p.slug)).toEqual([...POST_SLUGS]);
  });

  it("never collides with a reserved route segment under /blog", () => {
    for (const reserved of RESERVED_SEGMENTS) {
      expect(POST_SLUGS).not.toContain(reserved);
    }
  });
});

describe("CATEGORIES", () => {
  it("has unique ids and kebab-case slugs", () => {
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) expect(c.slug).toMatch(SLUG_RE);
  });

  it("is fully populated with a known accent", () => {
    for (const c of CATEGORIES) {
      expect(c.name.length).toBeGreaterThan(2);
      expect(c.tagline.length).toBeGreaterThan(5);
      expect(c.blurb.length).toBeGreaterThan(40);
      expect(["leaf", "ember", "teal", "sun"]).toContain(c.accent);
      for (const field of [c.name, c.tagline, c.blurb]) {
        expect(field).not.toMatch(PLACEHOLDER);
      }
      for (const g of c.groups ?? []) {
        expect(g.name.length).toBeGreaterThan(2);
        expect(g.blurb.length).toBeGreaterThan(20);
        expect(["leaf", "ember", "teal", "sun"]).toContain(g.accent);
      }
    }
  });

  it("every category still has at least one post", () => {
    // A topic card linking to an empty page reads as broken.
    for (const c of CATEGORIES) {
      expect({ id: c.id, count: getPostsIn(c.id).length }).toEqual({
        id: c.id,
        count: getPostsIn(c.id).length,
      });
      expect(getPostsIn(c.id).length).toBeGreaterThan(0);
    }
    expect(getPublishedCategories()).toHaveLength(CATEGORIES.length);
  });
});

describe("POSTS", () => {
  it("every post belongs to a real category", () => {
    for (const p of POSTS) {
      expect(getCategoryById(p.category)).toBeDefined();
    }
  });

  it("every group is declared on its category", () => {
    for (const p of POSTS) {
      if (!p.group) continue;
      const names = (getCategoryById(p.category)?.groups ?? []).map(
        (g) => g.name,
      );
      expect({ slug: p.slug, group: p.group, known: names.includes(p.group) })
        .toEqual({ slug: p.slug, group: p.group, known: true });
    }
  });

  it("has exactly one pillar per category, and fifteen running guides", () => {
    for (const c of CATEGORIES) {
      expect(
        getPostsIn(c.id).filter((p) => p.kind === "pillar"),
      ).toHaveLength(1);
    }
    expect(getPillarIn("running")?.kind).toBe("pillar");
    expect(getGuidesIn("running")).toHaveLength(15);
  });

  it("every entry is fully populated and slop-free", () => {
    for (const p of POSTS) {
      expect(p.title.length).toBeGreaterThan(10);
      expect(p.description.length).toBeGreaterThanOrEqual(50);
      expect(p.description.length).toBeLessThanOrEqual(160);
      expect(p.excerpt.length).toBeGreaterThan(40);
      expect(p.purpose.length).toBeGreaterThan(10);
      expect(p.readingMinutes).toBeGreaterThan(0);
      expect(p.readingMinutes).toBeLessThanOrEqual(15);
      for (const field of [p.title, p.description, p.excerpt, p.purpose]) {
        expect(field).not.toMatch(PLACEHOLDER);
      }
    }
  });

  it("every guide is grouped and effort-rated", () => {
    for (const g of getGuidesIn("running")) {
      expect(["Foundation", "Speed", "Strength", "Race"]).toContain(g.group);
      expect(["Easy", "Moderate", "Hard"]).toContain(g.effort);
    }
  });

  it("publishes with valid, non-future dates", () => {
    // A date string parses as UTC midnight, so a run from a UTC+N timezone
    // early on the publish date would otherwise read as "future". One day of
    // slack absorbs that without weakening the check meaningfully.
    const DAY_MS = 24 * 60 * 60 * 1000;
    for (const p of POSTS) {
      const published = new Date(p.published);
      expect(Number.isNaN(published.getTime())).toBe(false);
      expect(published.getTime()).toBeLessThanOrEqual(Date.now() + DAY_MS);
    }
  });
});

describe("helpers", () => {
  it("looks posts up by slug and rejects unknown ones", () => {
    expect(getPost("tempo-run")?.title).toContain("Tempo");
    expect(getPost("not-a-real-run")).toBeUndefined();
  });

  it("looks categories up by slug", () => {
    expect(getCategory("running")?.name).toBe("Running");
    expect(getCategory("nope")).toBeUndefined();
  });

  it("returns at most the requested number of latest posts", () => {
    expect(getLatestPosts(6)).toHaveLength(6);
    expect(getLatestPosts(999).length).toBe(POSTS.length);
  });

  it("walks prev/next inside one topic, with open ends", () => {
    const guides = getGuidesIn("running");
    expect(getAdjacent(guides[0].slug).prev).toBeNull();
    expect(getAdjacent(guides[0].slug).next?.slug).toBe(guides[1].slug);
    expect(getAdjacent(guides[guides.length - 1].slug).next).toBeNull();

    // Every neighbour shares the post's category.
    for (const g of guides) {
      const { prev, next } = getAdjacent(g.slug);
      for (const n of [prev, next]) {
        if (n) expect(n.category).toBe(g.category);
      }
    }

    const pillar = getAdjacent(getPillarIn("running")!.slug);
    expect(pillar.prev).toBeNull();
    expect(pillar.next).toBeNull();
  });

  it("builds absolute post and topic URLs", () => {
    expect(postUrl("tempo-run")).toBe("https://kamee.fit/blog/tempo-run");
    expect(topicPath("running")).toBe("/blog/topics/running");
    expect(topicUrl("running")).toBe("https://kamee.fit/blog/topics/running");
  });
});

describe("content/blog MDX files", () => {
  it("every file on disk has a registry entry", () => {
    for (const file of mdxFiles()) {
      const slug = file.replace(/\.mdx$/, "");
      expect(POST_SLUGS).toContain(slug);
    }
  });

  it("every registry entry has a file on disk", () => {
    const onDisk = new Set(mdxFiles().map((f) => f.replace(/\.mdx$/, "")));
    const missing = POST_SLUGS.filter((slug) => !onDisk.has(slug));
    expect(missing).toEqual([]);
  });

  it("no file declares a top-level H1", () => {
    for (const file of mdxFiles()) {
      const src = readFileSync(path.join(BLOG_DIR, file), "utf8");
      const offenders = src.split("\n").filter((line) => /^#\s/.test(line));
      expect({ file, offenders }).toEqual({ file, offenders: [] });
    }
  });

  it("no file carries unparsed frontmatter", () => {
    for (const file of mdxFiles()) {
      const src = readFileSync(path.join(BLOG_DIR, file), "utf8");
      expect(src.startsWith("---")).toBe(false);
    }
  });

  it("every file lands in its word-count band", () => {
    for (const file of mdxFiles()) {
      const slug = file.replace(/\.mdx$/, "");
      const words = wordCount(readFileSync(path.join(BLOG_DIR, file), "utf8"));
      const min = 600;
      const max = slug === "types-of-running-workouts" ? 1800 : 1100;
      expect({ slug, ok: words >= min && words <= max, words }).toEqual({
        slug,
        ok: true,
        words,
      });
    }
  });
});
