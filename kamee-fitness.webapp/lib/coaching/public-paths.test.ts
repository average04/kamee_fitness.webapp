import { describe, expect, it } from "vitest";
import { isPublicCoachingPath } from "./public-paths";

describe("isPublicCoachingPath", () => {
  it("allows the terms page and both invite pages", () => {
    expect(isPublicCoachingPath("/coaching/terms")).toBe(true);
    expect(isPublicCoachingPath("/coaching/invite")).toBe(true);
    expect(isPublicCoachingPath("/coaching/invite/67247c845a19daab")).toBe(true);
  });
  it("keeps the hub and anything deeper behind sign-in", () => {
    for (const p of [
      "/coaching",
      "/coaching/onboarding",
      "/coaching/profile",
      "/coaching/invite/",
      "/coaching/invite/abc/extra",
      "/coaching/terms/old",
      "/coaching/termsx",
    ]) {
      expect(isPublicCoachingPath(p)).toBe(false);
    }
  });
});
