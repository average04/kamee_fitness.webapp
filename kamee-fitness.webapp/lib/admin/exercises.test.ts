import { describe, expect, it } from "vitest";
import {
  parseExerciseForm,
  parseList,
  slugify,
  validateExerciseInput,
} from "./exercises";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Barbell Bench Press!")).toBe("barbell-bench-press");
  });
  it("collapses separators and trims hyphens", () => {
    expect(slugify("  DB --Row  ")).toBe("db-row");
  });
});

describe("parseList", () => {
  it("splits on newlines, trims, drops empties, dedupes", () => {
    expect(parseList("a\nb\n\n a \n c")).toEqual(["a", "b", "c"]);
  });
  it("returns [] for empty/nullish", () => {
    expect(parseList("")).toEqual([]);
    expect(parseList(null)).toEqual([]);
  });
});

describe("parseExerciseForm", () => {
  it("extracts fields, parses arrays, derives slug from name when blank", () => {
    const fd = new FormData();
    fd.set("name", "Goblet Squat");
    fd.set("slug", "");
    fd.set("primary_muscle", "quads");
    fd.set("secondary_muscles", "glutes\ncore");
    fd.set("equipment", "dumbbell");
    fd.set("cues", "chest up\nknees out");
    fd.set("common_mistakes", "heels lift");
    fd.set("demo_image_path", "");
    fd.set("demo_video_path", "");
    const out = parseExerciseForm(fd);
    expect(out.slug).toBe("goblet-squat");
    expect(out.secondary_muscles).toEqual(["glutes", "core"]);
    expect(out.equipment).toEqual(["dumbbell"]);
    expect(out.cues).toEqual(["chest up", "knees out"]);
    expect(out.demo_image_path).toBeNull();
  });
});

describe("validateExerciseInput", () => {
  const base = {
    name: "Squat",
    slug: "squat",
    primary_muscle: "quads",
    secondary_muscles: [],
    equipment: [],
    cues: [],
    common_mistakes: [],
    demo_image_path: null,
    demo_video_path: null,
  };
  it("accepts a valid input", () => {
    const r = validateExerciseInput(base);
    expect(r.ok).toBe(true);
  });
  it("flags a missing name", () => {
    const r = validateExerciseInput({ ...base, name: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeTruthy();
  });
  it("flags a malformed slug", () => {
    const r = validateExerciseInput({ ...base, slug: "Bad Slug" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.slug).toBeTruthy();
  });
});
