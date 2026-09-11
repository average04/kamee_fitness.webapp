import { describe, expect, it } from "vitest";
import { HUB_STATES, isHubState } from "./states";

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
