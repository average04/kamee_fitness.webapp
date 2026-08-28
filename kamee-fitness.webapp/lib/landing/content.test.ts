import { describe, expect, it } from "vitest";
import {
  BADGES,
  BADGE_TOTAL,
  COACH_POINTS,
  COMMUNITY_CARDS,
  FAQ,
  FEATURES,
  GPS_POINTS,
  LOG_POINTS,
  PLAN_NAMES,
  TICKER,
  type Point,
} from "./content";
import { APP_STORE_URL, PLAY_STORE_URL } from "./stores";

const PLACEHOLDER = /\b(tbd|todo|lorem|placeholder|xxx)\b/i;

/** Claims we must never make: paused, planned, or never-shipped features. */
const UNSHIPPED =
  /\b(on-device|coming soon|beta|replay video export|share to clubs)\b/i;

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
      expect(f.body).not.toMatch(UNSHIPPED);
      if (f.screenshot) expect(f.screenshot.startsWith("/screens/")).toBe(true);
    }
  });
});

describe("TICKER", () => {
  it("mirrors the feature keys so the chips and sections stay in step", () => {
    expect(TICKER.map((t) => t.key)).toEqual(FEATURES.map((f) => f.key));
  });

  it("labels are short enough to read as chips", () => {
    for (const chip of TICKER) {
      expect(chip.label.length).toBeGreaterThan(0);
      expect(chip.label.length).toBeLessThanOrEqual(16);
      expect(["leaf", "teal"]).toContain(chip.accent);
    }
  });
});

describe("section points", () => {
  const groups: [string, Point[]][] = [
    ["COACH_POINTS", COACH_POINTS],
    ["GPS_POINTS", GPS_POINTS],
    ["LOG_POINTS", LOG_POINTS],
    ["COMMUNITY_CARDS", COMMUNITY_CARDS],
  ];

  it.each(groups)("%s is populated with unique keys and real copy", (_, points) => {
    expect(points.length).toBeGreaterThanOrEqual(3);
    expect(new Set(points.map((p) => p.key)).size).toBe(points.length);
    for (const p of points) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.body.length).toBeGreaterThan(20);
      expect(p.title).not.toMatch(PLACEHOLDER);
      expect(p.body).not.toMatch(PLACEHOLDER);
      expect(p.body).not.toMatch(UNSHIPPED);
    }
  });
});

describe("PLAN_NAMES", () => {
  it("lists real catalog plans, starting with the flagship", () => {
    expect(PLAN_NAMES[0]).toBe("Couch to 5K");
    expect(new Set(PLAN_NAMES).size).toBe(PLAN_NAMES.length);
    for (const name of PLAN_NAMES) expect(name).not.toMatch(PLACEHOLDER);
  });
});

describe("BADGES", () => {
  it("every emblem has a described image that exists under /badges", () => {
    expect(BADGES.length).toBeGreaterThan(0);
    for (const b of BADGES) {
      expect(b.key).toMatch(/^[a-z0-9-]+$/);
      expect(b.alt.length).toBeGreaterThan(0);
    }
  });

  it("leaves a truthful remainder for the +N tile", () => {
    expect(BADGE_TOTAL).toBeGreaterThan(BADGES.length);
  });
});

describe("FAQ", () => {
  it("has five questions, each a real Q/A", () => {
    expect(FAQ).toHaveLength(5);
    for (const item of FAQ) {
      expect(item.q.endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(10);
      expect(item.a).not.toMatch(PLACEHOLDER);
      expect(item.a).not.toMatch(UNSHIPPED);
    }
  });
});

describe("store URLs", () => {
  it("point at the real listings", () => {
    expect(APP_STORE_URL).toContain("apps.apple.com");
    expect(PLAY_STORE_URL).toContain(
      "play.google.com/store/apps/details?id=com.kamee.fitness",
    );
  });
});
