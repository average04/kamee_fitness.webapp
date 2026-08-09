import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getAdjacent,
  getGuides,
  getPillar,
  getPost,
  POSTS,
  POST_SLUGS,
  postUrl,
} from "./posts";

const PLACEHOLDER = /\b(tbd|todo|lorem|placeholder|xxx)\b/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BLOG_DIR = path.join(process.cwd(), "content", "blog");

/** MDX files currently on disk. Empty before the content tasks land. */
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
});

describe("POSTS", () => {
  it("has exactly one pillar and fifteen guides", () => {
    expect(POSTS.filter((p) => p.kind === "pillar")).toHaveLength(1);
    expect(getGuides()).toHaveLength(15);
    expect(getPillar().kind).toBe("pillar");
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
    for (const g of getGuides()) {
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

  it("walks prev/next across guides only, with open ends", () => {
    const guides = getGuides();
    expect(getAdjacent(guides[0].slug).prev).toBeNull();
    expect(getAdjacent(guides[0].slug).next?.slug).toBe(guides[1].slug);
    expect(getAdjacent(guides[guides.length - 1].slug).next).toBeNull();
    const pillar = getAdjacent(getPillar().slug);
    expect(pillar.prev).toBeNull();
    expect(pillar.next).toBeNull();
  });

  it("builds absolute post URLs", () => {
    expect(postUrl("tempo-run")).toBe("https://kamee.fit/blog/tempo-run");
  });
});

describe("content/blog MDX files", () => {
  it("every file on disk has a registry entry", () => {
    for (const file of mdxFiles()) {
      const slug = file.replace(/\.mdx$/, "");
      expect(POST_SLUGS).toContain(slug);
    }
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
