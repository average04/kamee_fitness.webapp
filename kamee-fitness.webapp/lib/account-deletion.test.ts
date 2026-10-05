import { describe, expect, it } from "vitest";
import { formatPurgeDate, isDeleteConfirmation } from "./account-deletion";

describe("isDeleteConfirmation", () => {
  it("accepts DELETE, ignoring surrounding whitespace", () => {
    expect(isDeleteConfirmation("DELETE")).toBe(true);
    expect(isDeleteConfirmation("  DELETE ")).toBe(true);
  });

  it("is case-sensitive, like the app", () => {
    expect(isDeleteConfirmation("delete")).toBe(false);
    expect(isDeleteConfirmation("Delete")).toBe(false);
  });

  it("rejects anything that is not a string", () => {
    expect(isDeleteConfirmation(null)).toBe(false);
    expect(isDeleteConfirmation(undefined)).toBe(false);
    expect(isDeleteConfirmation(new Blob(["DELETE"]))).toBe(false);
  });

  it("rejects other text", () => {
    expect(isDeleteConfirmation("")).toBe(false);
    expect(isDeleteConfirmation("DELETE ME")).toBe(false);
  });
});

describe("formatPurgeDate", () => {
  it("formats in UTC so server and browser render the same text", () => {
    expect(formatPurgeDate("2026-11-04T23:30:00Z")).toBe("November 4, 2026");
    expect(formatPurgeDate("2026-11-05T00:30:00+01:00")).toBe("November 4, 2026");
  });

  it("returns null for a missing or unparseable date", () => {
    expect(formatPurgeDate(null)).toBeNull();
    expect(formatPurgeDate("not a date")).toBeNull();
  });
});
