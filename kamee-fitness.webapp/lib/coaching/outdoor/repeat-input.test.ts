import { describe, expect, it } from "vitest";
import { repeatInputState } from "./repeat-input";

describe("advanced repeat input draft", () => {
  it("keeps an empty edit separate from six committed repeats, then accepts eight", () => {
    const cleared = repeatInputState(6, "");
    expect(cleared).toMatchObject({ committed: 6, draft: "", value: null });
    expect(cleared.error).toContain("whole number from 1 to 100");
    expect(repeatInputState(cleared.committed, "8")).toEqual({
      committed: 6, draft: "8", value: 8, error: null,
    });
  });

  it.each(["101", "0", "-1", "1.5", "1e309"])(
    "retains invalid draft %j without changing the committed prescription",
    (draft) => {
      expect(repeatInputState(100, draft)).toMatchObject({
        committed: 100, draft, value: null,
      });
      expect(repeatInputState(100, draft).error).toContain("whole number from 1 to 100");
    },
  );

  it.each([[1, "1"], [100, "100"]] as const)("accepts boundary %i without an error", (value, draft) => {
    expect(repeatInputState(6, draft)).toEqual({ committed: 6, draft, value, error: null });
  });

  it("initializes a fresh text draft when the committed repeat changes", () => {
    const invalid = repeatInputState(6, "101");
    expect(invalid.draft).toBe("101");
    expect(repeatInputState(4)).toEqual({ committed: 4, draft: "4", value: 4, error: null });
  });
});
