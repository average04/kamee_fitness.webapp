import { describe, expect, it } from "vitest";
import { buildBlogFeed } from "./feed";
import { POSTS } from "./posts";

describe("buildBlogFeed", () => {
  const feed = buildBlogFeed();

  it("emits one entry per registry post", () => {
    expect(feed.posts).toHaveLength(POSTS.length);
    expect(new Set(feed.posts.map((p) => p.slug)).size).toBe(POSTS.length);
  });

  it("builds absolute kamee.fit URLs", () => {
    for (const p of feed.posts) {
      expect(p.url).toBe(`https://kamee.fit/blog/${p.slug}`);
    }
  });

  it("derives accent from the post's group, falling back to category accent", () => {
    const tempo = feed.posts.find((p) => p.slug === "tempo-run")!;
    expect(tempo.accent).toBe("ember"); // Speed group
    const pillar = feed.posts.find((p) => p.slug === "types-of-running-workouts")!;
    expect(pillar.group).toBeNull();
    expect(pillar.accent).toBe("leaf"); // running category accent
  });

  it("carries the fields the app renders", () => {
    for (const p of feed.posts) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.excerpt.length).toBeGreaterThan(40);
      expect(p.readingMinutes).toBeGreaterThanOrEqual(1);
      expect(["pillar", "guide"]).toContain(p.kind);
      expect(["leaf", "ember", "teal", "sun"]).toContain(p.accent);
      expect(() => new Date(p.published)).not.toThrow();
    }
  });
});
