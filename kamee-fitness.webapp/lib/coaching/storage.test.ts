import { describe, expect, it } from "vitest";
import { buildCoverPath, buildPublicStorageUrl, checkImageFile } from "./storage";

describe("buildCoverPath", () => {
  it("builds a coaching/<uid>/cover/<ts>.jpg path (the CHECK constraint on coaching_profiles.cover_image_path requires this shape)", () => {
    expect(buildCoverPath("u1", 12345)).toBe("coaching/u1/cover/12345.jpg");
  });
  it("defaults the timestamp to now when omitted", () => {
    const p = buildCoverPath("u1");
    expect(p).toMatch(/^coaching\/u1\/cover\/\d+\.jpg$/);
  });
});

describe("buildPublicStorageUrl", () => {
  it("builds the public social-photos object URL", () => {
    expect(buildPublicStorageUrl("https://proj.supabase.co", "coaching/u1/cover/1.jpg")).toBe(
      "https://proj.supabase.co/storage/v1/object/public/social-photos/coaching/u1/cover/1.jpg",
    );
  });
});

describe("checkImageFile", () => {
  it("accepts jpeg/png/webp under 5 MB", () => {
    expect(checkImageFile({ type: "image/jpeg", size: 1024 })).toEqual({ ok: true });
    expect(checkImageFile({ type: "image/png", size: 1024 })).toEqual({ ok: true });
    expect(checkImageFile({ type: "image/webp", size: 1024 })).toEqual({ ok: true });
  });
  it("rejects other file types with a friendly message", () => {
    const r = checkImageFile({ type: "image/gif", size: 1024 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/jpeg|png|webp/i);
  });
  it("rejects files over 5 MB with a friendly message", () => {
    const r = checkImageFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/5 ?MB/i);
  });
  it("accepts a file exactly at the 5 MB boundary", () => {
    expect(checkImageFile({ type: "image/png", size: 5 * 1024 * 1024 })).toEqual({ ok: true });
  });
});
