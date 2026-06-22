import { afterEach, describe, expect, it } from "vitest";
import { clamp, normalizePointer, prefersReducedMotion } from "./parallax";

describe("clamp", () => {
  it("bounds values to the range", () => {
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(-5, -1, 1)).toBe(-1);
    expect(clamp(0.25, -1, 1)).toBe(0.25);
  });
});

describe("normalizePointer", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 };
  it("maps the center to (0,0)", () => {
    expect(normalizePointer(100, 50, rect)).toEqual({ x: 0, y: 0 });
  });
  it("maps the top-left corner to (-1,-1)", () => {
    expect(normalizePointer(0, 0, rect)).toEqual({ x: -1, y: -1 });
  });
  it("clamps points outside the element", () => {
    expect(normalizePointer(400, 200, rect)).toEqual({ x: 1, y: 1 });
  });
});

describe("prefersReducedMotion", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });
  it("returns false when there is no window (SSR)", () => {
    expect(prefersReducedMotion()).toBe(false);
  });
  it("reflects the media query when present", () => {
    (globalThis as { window?: unknown }).window = {
      matchMedia: () => ({ matches: true }),
    };
    expect(prefersReducedMotion()).toBe(true);
  });
});
