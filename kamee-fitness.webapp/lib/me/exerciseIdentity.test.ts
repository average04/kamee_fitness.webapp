import { describe, expect, it } from "vitest";
import { exerciseHref, parseExerciseKey } from "./exerciseIdentity";

const id = "11111111-1111-4111-8111-111111111111";
describe("exercise identity routes", () => {
  it("keeps equal catalog and personal UUIDs distinct and encodes once", () => {
    expect(parseExerciseKey(`personal:${id}`)).toEqual({ source: "personal", id, key: `personal:${id}` });
    expect(parseExerciseKey(`catalog:${id}`).key).not.toBe(parseExerciseKey(`personal:${id}`).key);
    expect(exerciseHref(`personal:${id}`)).toBe(`/me/exercises/personal%3A${id}`);
  });
  it("resolves legacy UUID bookmarks only as catalog", () => {
    expect(parseExerciseKey(id)).toEqual({ source: "catalog", id, key: `catalog:${id}` });
    expect(exerciseHref(id)).toBe(`/me/exercises/catalog%3A${id}`);
  });
  it.each([`private:${id}`, "bad", `personal%3A${id}`, `catalog:${id}:extra`])("rejects malformed or already encoded identity %s", (key) => {
    expect(() => parseExerciseKey(key)).toThrow();
  });
});
