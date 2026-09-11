import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

const ORIGIN = "https://kamee.fit";

describe("safeNextPath", () => {
  it("falls back on null/undefined/empty", () => {
    expect(safeNextPath(null, ORIGIN)).toBe("/me");
    expect(safeNextPath(undefined, ORIGIN)).toBe("/me");
    expect(safeNextPath("", ORIGIN)).toBe("/me");
  });

  it("honours a custom fallback", () => {
    expect(safeNextPath(null, ORIGIN, "/admin/exercises")).toBe(
      "/admin/exercises",
    );
  });

  it("passes through a same-origin path unchanged", () => {
    expect(safeNextPath("/coaching/invite/abc", ORIGIN)).toBe(
      "/coaching/invite/abc",
    );
  });

  it("keeps search and hash", () => {
    expect(safeNextPath("/me?x=1#y", ORIGIN)).toBe("/me?x=1#y");
  });

  it("rejects protocol-relative //evil.com", () => {
    expect(safeNextPath("//evil.com", ORIGIN)).toBe("/me");
  });

  it("rejects backslash origin-confusion /\\evil.com", () => {
    expect(safeNextPath("/\\evil.com", ORIGIN)).toBe("/me");
  });

  it("rejects /\\/evil.com", () => {
    expect(safeNextPath("/\\/evil.com", ORIGIN)).toBe("/me");
  });

  it("rejects an absolute cross-origin URL", () => {
    expect(safeNextPath("https://evil.com/x", ORIGIN)).toBe("/me");
  });

  it("keeps a percent-encoded double slash same-origin", () => {
    const result = safeNextPath("/%2F%2Fevil.com", ORIGIN);
    expect(result.startsWith("/")).toBe(true);
    expect(new URL(result, ORIGIN).origin).toBe(ORIGIN);
  });

  it("never yields another origin for a tab-prefixed value", () => {
    const result = safeNextPath("/\t/evil.com", ORIGIN);
    expect(new URL(result, ORIGIN).origin).toBe(ORIGIN);
  });

  it("rejects a javascript: URL", () => {
    expect(safeNextPath("javascript:alert(1)", ORIGIN)).toBe("/me");
  });
});
