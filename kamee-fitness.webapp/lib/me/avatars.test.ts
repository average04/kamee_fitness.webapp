import { describe, expect, it } from "vitest";
import { avatarSrc } from "./avatars";

describe("avatarSrc", () => {
  it("maps preset avatar keys to ported web asset paths", () => {
    expect(avatarSrc("female-coder")).toBe("/avatars/female/coder.png");
    expect(avatarSrc("male-cool")).toBe("/avatars/male/cool.png");
    expect(avatarSrc("male-astronaut")).toBe("/avatars/male/astronaut.png");
  });
  it("passes real URLs through unchanged", () => {
    expect(avatarSrc("https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
    expect(avatarSrc("http://example.com/a.png")).toBe(
      "http://example.com/a.png",
    );
  });
  it("returns null for null, empty, or unknown keys", () => {
    expect(avatarSrc(null)).toBeNull();
    expect(avatarSrc(undefined)).toBeNull();
    expect(avatarSrc("")).toBeNull();
    expect(avatarSrc("not-a-real-avatar")).toBeNull();
    expect(avatarSrc("randomstring")).toBeNull();
    expect(avatarSrc("male-bogus")).toBeNull();
  });
});
