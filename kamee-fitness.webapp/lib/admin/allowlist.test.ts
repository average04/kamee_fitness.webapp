import { describe, expect, it } from "vitest";
import { isAllowed, parseAllowlist } from "./allowlist";

describe("parseAllowlist", () => {
  it("splits, trims, and lowercases", () => {
    expect(parseAllowlist("A@x.com, B@Y.com")).toEqual(["a@x.com", "b@y.com"]);
  });
  it("returns [] for undefined/empty", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("   ,  ")).toEqual([]);
  });
});

describe("isAllowed", () => {
  const list = ["a@x.com"];
  it("matches case-insensitively", () => {
    expect(isAllowed("A@X.com", list)).toBe(true);
  });
  it("rejects non-members and nullish", () => {
    expect(isAllowed("z@x.com", list)).toBe(false);
    expect(isAllowed(null, list)).toBe(false);
    expect(isAllowed(undefined, list)).toBe(false);
  });
});
