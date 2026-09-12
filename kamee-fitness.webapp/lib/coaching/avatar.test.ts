import { describe, expect, it } from "vitest";
import { avatarImageUrl, avatarInitial } from "./avatar";

const SUPABASE = "https://proj.supabase.co";

describe("avatarImageUrl", () => {
  it("builds the social-photos public URL for an uploaded photo path", () => {
    expect(avatarImageUrl("avatars/u1/123.jpg", SUPABASE)).toBe(
      "https://proj.supabase.co/storage/v1/object/public/social-photos/avatars/u1/123.jpg",
    );
  });

  it("returns null when there is no uploaded photo", () => {
    expect(avatarImageUrl(null, SUPABASE)).toBeNull();
    expect(avatarImageUrl(undefined, SUPABASE)).toBeNull();
    expect(avatarImageUrl("", SUPABASE)).toBeNull();
    expect(avatarImageUrl("   ", SUPABASE)).toBeNull();
  });

  it("returns null without a Supabase URL rather than a relative src", () => {
    expect(avatarImageUrl("avatars/u1/123.jpg", "")).toBeNull();
  });
});

describe("avatarInitial", () => {
  it("uses the first letter of the name, uppercased", () => {
    expect(avatarInitial("ana reyes")).toBe("A");
    expect(avatarInitial("  bea")).toBe("B");
  });

  it("falls back to a neutral mark for a blank name", () => {
    expect(avatarInitial("")).toBe("?");
    expect(avatarInitial(null)).toBe("?");
    expect(avatarInitial("   ")).toBe("?");
  });

  it("keeps a whole astral-plane character rather than half a surrogate pair", () => {
    expect(avatarInitial("\u{1D400}bc")).toBe("\u{1D400}");
  });
});
