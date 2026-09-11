import { describe, expect, it } from "vitest";
import {
  describeRpcError,
  isCoachStatusAction,
  isReviewDecision,
  isUuid,
  sanitizeNote,
} from "./admin";

describe("isUuid", () => {
  it("accepts a valid v4 UUID", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });
  it("accepts uppercase hex", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111".toUpperCase())).toBe(true);
  });
  it("rejects non-uuid strings", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
  it("rejects non-string input", () => {
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid({ id: "11111111-1111-4111-8111-111111111111" })).toBe(false);
  });
});

describe("isReviewDecision", () => {
  it("accepts the exact allowed values", () => {
    expect(isReviewDecision("approved")).toBe(true);
    expect(isReviewDecision("changes_requested")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isReviewDecision("Approved")).toBe(false);
    expect(isReviewDecision("suspended")).toBe(false);
    expect(isReviewDecision(undefined)).toBe(false);
    expect(isReviewDecision(1)).toBe(false);
  });
});

describe("isCoachStatusAction", () => {
  it("accepts the exact allowed values", () => {
    expect(isCoachStatusAction("suspended")).toBe(true);
    expect(isCoachStatusAction("approved")).toBe(true);
    expect(isCoachStatusAction("revoked")).toBe(true);
  });
  it("rejects anything else, including hub-only statuses", () => {
    expect(isCoachStatusAction("in_review")).toBe(false);
    expect(isCoachStatusAction("none")).toBe(false);
    expect(isCoachStatusAction(undefined)).toBe(false);
  });
});

describe("sanitizeNote", () => {
  it("trims whitespace", () => {
    expect(sanitizeNote("  hello  ")).toBe("hello");
  });
  it("returns an empty string for non-string input", () => {
    expect(sanitizeNote(undefined)).toBe("");
    expect(sanitizeNote(null)).toBe("");
    expect(sanitizeNote(42)).toBe("");
  });
  it("caps at 2000 characters", () => {
    const long = "a".repeat(2500);
    const out = sanitizeNote(long);
    expect(out.length).toBe(2000);
  });
});

describe("describeRpcError", () => {
  it("expands incomplete:<keys> using MISSING_LABELS", () => {
    const msg = describeRpcError("incomplete:headline,about");
    expect(msg).toContain("Add a headline");
    expect(msg).toContain("Write at least 80 characters about yourself");
  });
  it("falls back to the raw key for an unknown incomplete key", () => {
    const msg = describeRpcError("incomplete:mystery_key");
    expect(msg).toContain("mystery_key");
  });
  it("gives a review-specific message for wrong_state in review context", () => {
    expect(describeRpcError("wrong_state", "review")).toBe(
      "This coach is not waiting for review.",
    );
  });
  it("gives a status-specific message for wrong_state in status context", () => {
    expect(describeRpcError("wrong_state", "status")).toBe(
      "That change is not allowed from the current status.",
    );
  });
  it("gives a generic wrong_state message with no context", () => {
    expect(describeRpcError("wrong_state")).toMatch(/not allowed/i);
  });
  it("maps known error codes to readable copy", () => {
    expect(describeRpcError("user_not_found")).toMatch(/could not be found/i);
    expect(describeRpcError("bad_decision")).toMatch(/invalid/i);
    expect(describeRpcError("bad_status")).toMatch(/invalid/i);
    expect(describeRpcError("not_found")).toMatch(/credential/i);
  });
  it("never surfaces an unknown/raw internal error message", () => {
    const msg = describeRpcError('duplicate key value violates unique constraint "x"');
    expect(msg).not.toContain("duplicate key");
    expect(msg).not.toContain("constraint");
  });
});
