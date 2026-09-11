import { describe, expect, it } from "vitest";
import {
  buildCoverPath,
  buildPublicStorageUrl,
  checkImageFile,
  extensionForMimeType,
  isOwnCoverPath,
} from "./storage";

describe("extensionForMimeType", () => {
  it("maps the three allowed mime types to their extensions", () => {
    expect(extensionForMimeType("image/jpeg")).toBe("jpg");
    expect(extensionForMimeType("image/png")).toBe("png");
    expect(extensionForMimeType("image/webp")).toBe("webp");
  });
  it("returns null for anything else", () => {
    expect(extensionForMimeType("image/gif")).toBeNull();
    expect(extensionForMimeType("")).toBeNull();
  });
});

describe("buildCoverPath", () => {
  it("builds a coaching/<uid>/cover/<ts>.<ext> path (the CHECK constraint on coaching_profiles.cover_image_path requires this shape)", () => {
    expect(buildCoverPath("u1", "jpg", 12345)).toBe("coaching/u1/cover/12345.jpg");
    expect(buildCoverPath("u1", "png", 12345)).toBe("coaching/u1/cover/12345.png");
    expect(buildCoverPath("u1", "webp", 12345)).toBe("coaching/u1/cover/12345.webp");
  });
  it("defaults the timestamp to now when omitted", () => {
    const p = buildCoverPath("u1", "jpg");
    expect(p).toMatch(/^coaching\/u1\/cover\/\d+\.jpg$/);
  });
});

describe("isOwnCoverPath", () => {
  const uid = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";

  it("accepts a well-formed own cover path for each allowed extension", () => {
    expect(isOwnCoverPath(`coaching/${uid}/cover/1700000000000.jpg`, uid)).toBe(true);
    expect(isOwnCoverPath(`coaching/${uid}/cover/1700000000000.png`, uid)).toBe(true);
    expect(isOwnCoverPath(`coaching/${uid}/cover/1700000000000.webp`, uid)).toBe(true);
  });
  it("rejects path traversal", () => {
    expect(isOwnCoverPath(`coaching/${uid}/cover/../../etc/passwd.jpg`, uid)).toBe(false);
    expect(isOwnCoverPath(`coaching/${uid}/../${other}/cover/1.jpg`, uid)).toBe(false);
  });
  it("rejects another user's uid", () => {
    expect(isOwnCoverPath(`coaching/${other}/cover/1.jpg`, uid)).toBe(false);
  });
  it("rejects the wrong sub-folder", () => {
    expect(isOwnCoverPath(`coaching/${uid}/gallery/1.jpg`, uid)).toBe(false);
  });
  it("rejects a missing extension", () => {
    expect(isOwnCoverPath(`coaching/${uid}/cover/1700000000000`, uid)).toBe(false);
  });
  it("rejects an unsupported extension", () => {
    expect(isOwnCoverPath(`coaching/${uid}/cover/1.gif`, uid)).toBe(false);
  });
  it("rejects overlong input", () => {
    const huge = `coaching/${uid}/cover/${"1".repeat(400)}.jpg`;
    expect(isOwnCoverPath(huge, uid)).toBe(false);
  });
  it("rejects a non-string path", () => {
    expect(isOwnCoverPath(123, uid)).toBe(false);
    expect(isOwnCoverPath(null, uid)).toBe(false);
    expect(isOwnCoverPath(undefined, uid)).toBe(false);
  });
  it("rejects when the uid itself isn't a UUID, rather than building an unanchored regex", () => {
    expect(isOwnCoverPath(`coaching/not-a-uuid/cover/1.jpg`, "not-a-uuid")).toBe(false);
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
