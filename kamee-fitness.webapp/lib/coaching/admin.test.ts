import { describe, expect, it } from "vitest";
import {
  coerceCredentialEvidence,
  credentialEvidenceMatches,
  type CredentialEvidence,
  describeRpcError,
  isCoachStatusAction,
  isReviewDecision,
  isUuid,
  validateNote,
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

describe("validateNote", () => {
  it("trims whitespace", () => {
    expect(validateNote("  hello  ")).toEqual({ ok: true, value: "hello" });
  });
  it("treats non-string input as an empty, valid note", () => {
    expect(validateNote(undefined)).toEqual({ ok: true, value: "" });
    expect(validateNote(null)).toEqual({ ok: true, value: "" });
    expect(validateNote(42)).toEqual({ ok: true, value: "" });
  });
  it("accepts a note at exactly 2000 characters", () => {
    const exact = "a".repeat(2000);
    expect(validateNote(exact)).toEqual({ ok: true, value: exact });
  });
  it("rejects (never truncates) a note over 2000 characters", () => {
    const long = "a".repeat(2500);
    const result = validateNote(long);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Note must be 2000 characters or fewer.");
    }
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
    expect(describeRpcError("wrong_state")).toBe(
      "That action is not allowed from the coach's current status.",
    );
  });
  it("maps known error codes to exact readable copy", () => {
    expect(describeRpcError("user_not_found")).toBe("That user could not be found.");
    expect(describeRpcError("bad_decision")).toBe("Invalid review decision.");
    expect(describeRpcError("bad_status")).toBe("Invalid status change.");
    expect(describeRpcError("not_found")).toBe("That credential could not be found.");
  });
  it("never surfaces an unknown/raw internal error message", () => {
    const msg = describeRpcError('duplicate key value violates unique constraint "x"');
    expect(msg).toBe("Something went wrong. Please try again.");
  });
});

describe("credentialEvidenceMatches", () => {
  const base: CredentialEvidence = {
    documentPath: "u1/c1/doc.pdf",
    title: "CPT",
    issuer: "NASM",
    issuedYear: 2020,
    expiresOn: "2027-01-01",
  };

  it("matches identical evidence", () => {
    expect(credentialEvidenceMatches(base, { ...base })).toBe(true);
  });

  it("detects each field differing on its own", () => {
    expect(credentialEvidenceMatches(base, { ...base, title: "CPT II" })).toBe(false);
    expect(credentialEvidenceMatches(base, { ...base, issuer: "ACE" })).toBe(false);
    expect(credentialEvidenceMatches(base, { ...base, issuedYear: 2021 })).toBe(false);
    expect(credentialEvidenceMatches(base, { ...base, documentPath: "u1/c1/other.pdf" })).toBe(
      false,
    );
    expect(credentialEvidenceMatches(base, { ...base, expiresOn: "2028-01-01" })).toBe(false);
  });

  it("treats a null document on one side and present on the other as a mismatch", () => {
    expect(credentialEvidenceMatches({ ...base, documentPath: null }, base)).toBe(false);
    expect(credentialEvidenceMatches(base, { ...base, documentPath: null })).toBe(false);
  });

  it("treats null documents on both sides as a match", () => {
    expect(
      credentialEvidenceMatches({ ...base, documentPath: null }, { ...base, documentPath: null }),
    ).toBe(true);
  });

  it("compares expires_on as a date, tolerating an ISO-timestamp vs date-only formatting difference for the same day", () => {
    expect(
      credentialEvidenceMatches(
        { ...base, expiresOn: "2027-01-01" },
        { ...base, expiresOn: "2027-01-01T00:00:00.000Z" },
      ),
    ).toBe(true);
  });

  it("treats null expiry on both sides as a match, and null vs set as a mismatch", () => {
    expect(
      credentialEvidenceMatches({ ...base, expiresOn: null }, { ...base, expiresOn: null }),
    ).toBe(true);
    expect(credentialEvidenceMatches({ ...base, expiresOn: null }, base)).toBe(false);
  });
});

describe("coerceCredentialEvidence", () => {
  it("accepts a well-shaped object", () => {
    expect(
      coerceCredentialEvidence({
        documentPath: "u1/c1/doc.pdf",
        title: "CPT",
        issuer: "NASM",
        issuedYear: 2020,
        expiresOn: "2027-01-01",
      }),
    ).toEqual({
      documentPath: "u1/c1/doc.pdf",
      title: "CPT",
      issuer: "NASM",
      issuedYear: 2020,
      expiresOn: "2027-01-01",
    });
  });

  it("accepts null documentPath, issuedYear, and expiresOn", () => {
    expect(
      coerceCredentialEvidence({
        documentPath: null,
        title: "CPT",
        issuer: "NASM",
        issuedYear: null,
        expiresOn: null,
      }),
    ).toEqual({
      documentPath: null,
      title: "CPT",
      issuer: "NASM",
      issuedYear: null,
      expiresOn: null,
    });
  });

  it("rejects a non-object", () => {
    expect(coerceCredentialEvidence(null)).toBeNull();
    expect(coerceCredentialEvidence(undefined)).toBeNull();
    expect(coerceCredentialEvidence("x")).toBeNull();
    expect(coerceCredentialEvidence(42)).toBeNull();
  });

  it("rejects a wrong-typed field", () => {
    const good = { documentPath: null, title: "a", issuer: "b", issuedYear: null, expiresOn: null };
    expect(coerceCredentialEvidence({ ...good, documentPath: 1 })).toBeNull();
    expect(coerceCredentialEvidence({ ...good, title: 1 })).toBeNull();
    expect(coerceCredentialEvidence({ ...good, issuer: 1 })).toBeNull();
    expect(coerceCredentialEvidence({ ...good, issuedYear: "2020" })).toBeNull();
    expect(coerceCredentialEvidence({ ...good, expiresOn: 123 })).toBeNull();
  });
});
