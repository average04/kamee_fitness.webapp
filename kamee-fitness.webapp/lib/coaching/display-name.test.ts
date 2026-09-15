import { describe, expect, it } from "vitest";
import { validateDisplayName } from "./display-name";

describe("display-name submissions", () => {
  it.each([null, undefined, 12, {}, "", "   ", "A\u0000B"])("rejects invalid input %j", raw => {
    expect(validateDisplayName(raw)).toEqual({ message: "Enter your display name." });
  });
  it("trims surrounding whitespace and preserves the chosen identity", () => {
    expect(validateDisplayName("  María O’Neil  ")).toEqual({ name: "María O’Neil" });
  });
  it("accepts exactly 120 characters after trimming", () => {
    expect(validateDisplayName(` ${"a".repeat(120)} `)).toEqual({ name: "a".repeat(120) });
  });
  it("rejects oversized names without silently truncating them", () => {
    const existing = "a".repeat(121);
    expect(validateDisplayName(existing)).toEqual({ message: "Use 120 characters or fewer for your display name." });
    expect(existing).toHaveLength(121);
  });
});
