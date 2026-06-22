import { describe, expect, it } from "vitest";
import { FAQ, FEATURES } from "./content";
import { APP_STORE_URL, PLAY_STORE_URL } from "./stores";

const PLACEHOLDER = /\b(tbd|todo|lorem|placeholder|xxx)\b/i;

describe("FEATURES", () => {
  it("has the six real features with unique keys", () => {
    expect(FEATURES).toHaveLength(6);
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(6);
  });
  it("every feature is fully populated and slop-free", () => {
    for (const f of FEATURES) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.body.length).toBeGreaterThan(20);
      expect(["leaf", "teal"]).toContain(f.accent);
      expect(f.title).not.toMatch(PLACEHOLDER);
      expect(f.body).not.toMatch(PLACEHOLDER);
      if (f.screenshot) expect(f.screenshot.startsWith("/screens/")).toBe(true);
    }
  });
});

describe("FAQ", () => {
  it("has five questions, each a real Q/A", () => {
    expect(FAQ).toHaveLength(5);
    for (const item of FAQ) {
      expect(item.q.endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(10);
      expect(item.a).not.toMatch(PLACEHOLDER);
    }
  });
});

describe("store URLs", () => {
  it("point at the real listings", () => {
    expect(APP_STORE_URL).toContain("apps.apple.com");
    expect(PLAY_STORE_URL).toContain(
      "play.google.com/apps/testing/com.kamee.fitness",
    );
  });
});
