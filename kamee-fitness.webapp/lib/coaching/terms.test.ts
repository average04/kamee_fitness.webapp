import { describe, expect, it } from "vitest";
import { acceptTermsErrorMessage, coachTermsState, isTermsVersion } from "./terms";

const current = { version: "2026-09-15", url: "https://kamee.fit/coaching/terms", publishedAt: "2026-09-15T00:00:00Z" };
const deployed = { version: "2026-09-15", draft: false };
const never = { terms_accepted_at: null, terms_version: null };

describe("isTermsVersion", () => {
  it("accepts the database's version shapes", () => {
    expect(isTermsVersion("2026-09-15")).toBe(true);
    expect(isTermsVersion("2026-09-15.2")).toBe(true);
  });
  it("rejects anything else a caller could post", () => {
    for (const v of [null, undefined, 20260915, "", "2026-9-15", "2026-09-15.", "2026-09-15; drop", "x".repeat(40)]) {
      expect(isTermsVersion(v)).toBe(false);
    }
  });
});

describe("coachTermsState", () => {
  it("is unavailable when nothing is published", () => {
    expect(coachTermsState(never, null, deployed)).toEqual({ kind: "unavailable" });
  });

  it("is unavailable while the deployed text is still a draft", () => {
    expect(coachTermsState(never, current, { ...deployed, draft: true })).toEqual({ kind: "unavailable" });
  });

  it("is unavailable when the deployed text and the published version disagree", () => {
    expect(coachTermsState(never, current, { version: "2026-10-01", draft: false })).toEqual({
      kind: "unavailable",
    });
  });

  it("asks a coach who never accepted", () => {
    expect(coachTermsState(never, current, deployed)).toEqual({
      kind: "needs_acceptance",
      version: "2026-09-15",
      previous: null,
    });
  });

  it("asks again after a new version, remembering the earlier acceptance", () => {
    const row = { terms_accepted_at: "2026-09-16T01:00:00Z", terms_version: "2026-09-15" };
    const next = { ...current, version: "2026-12-01" };
    expect(coachTermsState(row, next, { version: "2026-12-01", draft: false })).toEqual({
      kind: "needs_acceptance",
      version: "2026-12-01",
      previous: { version: "2026-09-15", acceptedAt: "2026-09-16T01:00:00Z" },
    });
  });

  it("treats a legacy checkbox acceptance with no version as needing acceptance", () => {
    const row = { terms_accepted_at: "2026-09-10T00:00:00Z", terms_version: null };
    expect(coachTermsState(row, current, deployed)).toMatchObject({
      kind: "needs_acceptance",
      previous: { version: null },
    });
  });

  it("is accepted for the current version", () => {
    const row = { terms_accepted_at: "2026-09-16T01:00:00Z", terms_version: "2026-09-15" };
    expect(coachTermsState(row, current, deployed)).toEqual({
      kind: "accepted",
      version: "2026-09-15",
      acceptedAt: "2026-09-16T01:00:00Z",
    });
  });
});

describe("acceptTermsErrorMessage", () => {
  it("maps each database error to coach-facing copy", () => {
    expect(acceptTermsErrorMessage("terms_outdated")).toMatch(/updated/);
    expect(acceptTermsErrorMessage("terms_unavailable")).toMatch(/not open/);
    expect(acceptTermsErrorMessage("not_editable")).toMatch(/paused/);
    expect(acceptTermsErrorMessage("profile_missing")).toMatch(/retry/);
    expect(acceptTermsErrorMessage(undefined)).toMatch(/retry/);
  });
});
