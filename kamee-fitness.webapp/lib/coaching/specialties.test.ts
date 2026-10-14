import { describe, expect, it } from "vitest";
import { addSpecialty, customSpecialties, isSpecialtySelected, toggleSpecialty } from "./specialties";

describe("specialty selections", () => {
  const options = ["Running", "Endurance"];

  it("recognizes a stored preset variant without rewriting it or treating it as custom", () => {
    const selected = [" running ", "RUNNING", "Strength, balance", "Legacy coaching"];
    expect(isSpecialtySelected(selected, "Running")).toBe(true);
    expect(customSpecialties(selected, options)).toEqual([
      { label: "Strength, balance", index: 2 },
      { label: "Legacy coaching", index: 3 },
    ]);
    expect(toggleSpecialty(selected, "Running", true)).toEqual(selected);
    expect(toggleSpecialty(selected, "Running", false)).toEqual(["Strength, balance", "Legacy coaching"]);
  });

  it("stores a newly selected preset exactly as supplied by the server", () => {
    expect(toggleSpecialty(["Legacy coaching"], "Endurance", true)).toEqual(["Legacy coaching", "Endurance"]);
  });

  it("trims custom input and preserves an internal comma as one specialty", () => {
    expect(addSpecialty(["Running"], "  Strength, balance  ")).toEqual({
      ok: true, value: ["Running", "Strength, balance"],
    });
  });

  it("rejects empty, overlong and case-insensitive duplicate custom input", () => {
    expect(addSpecialty([], "  ")).toMatchObject({ ok: false, error: expect.stringMatching(/enter/i) });
    expect(addSpecialty([], "x".repeat(161))).toMatchObject({ ok: false, error: expect.stringMatching(/160/) });
    expect(addSpecialty([" running "], "RUNNING")).toMatchObject({ ok: false, error: expect.stringMatching(/already/i) });
    expect(addSpecialty([], "x".repeat(160))).toMatchObject({ ok: true });
  });

  it("counts presets and legacy/custom values toward the combined eight-item limit", () => {
    const selected = ["Running", "Legacy 1", "Legacy 2", "Legacy 3", "Legacy 4", "Legacy 5", "Legacy 6", "Legacy 7"];
    expect(addSpecialty(selected, "Endurance")).toMatchObject({ ok: false, error: expect.stringMatching(/8/) });
    expect(toggleSpecialty(selected, "Endurance", true)).toEqual(selected);
    expect(toggleSpecialty(selected, "Running", false)).toEqual(selected.slice(1));
    expect(addSpecialty(selected.slice(1), "Endurance")).toMatchObject({ ok: true });
  });

  it("keeps duplicate legacy custom labels independently removable by their original indices", () => {
    expect(customSpecialties(["Boxing", "boxing", "Running"], options)).toEqual([
      { label: "Boxing", index: 0 }, { label: "boxing", index: 1 },
    ]);
  });
});
