import { describe, expect, it } from "vitest";
import { COACH_STATUS_LABEL, HUB_STATES, isHubState } from "./states";

describe("isHubState", () => {
  it("accepts every hub state", () => {
    for (const s of HUB_STATES) expect(isHubState(s)).toBe(true);
  });
  it("rejects invited/none/revoked", () => {
    expect(isHubState("invited")).toBe(false);
    expect(isHubState("none")).toBe(false);
    expect(isHubState("revoked")).toBe(false);
  });
});

describe("COACH_STATUS_LABEL", () => {
  it("labels every coach status", () => {
    const all = [
      "none",
      "pending",
      "rejected",
      "invited",
      "onboarding",
      "in_review",
      "changes_requested",
      "approved",
      "suspended",
      "revoked",
    ];
    expect(Object.keys(COACH_STATUS_LABEL).sort()).toEqual([...all].sort());
    expect(COACH_STATUS_LABEL.in_review).toBe("In review");
    expect(COACH_STATUS_LABEL.changes_requested).toBe("Changes requested");
  });
});
