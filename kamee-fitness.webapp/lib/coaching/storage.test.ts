import { describe, expect, it } from "vitest";
import {
  buildCoverPath,
  buildPublicStorageUrl,
  checkDocumentFile,
  checkImageFile,
  extensionForDocumentMimeType,
  extensionForMimeType,
  isOwnCoverPath,
  isOwnCredentialDocPath,
  isOwnGalleryPath,
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

describe("isOwnGalleryPath", () => {
  const uid = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";

  it("accepts a well-formed own gallery path for each allowed extension", () => {
    expect(isOwnGalleryPath(`coaching/${uid}/gallery/1700000000000.jpg`, uid)).toBe(true);
    expect(isOwnGalleryPath(`coaching/${uid}/gallery/1700000000000.png`, uid)).toBe(true);
    expect(isOwnGalleryPath(`coaching/${uid}/gallery/1700000000000.webp`, uid)).toBe(true);
  });
  it("rejects path traversal", () => {
    expect(isOwnGalleryPath(`coaching/${uid}/gallery/../../etc/passwd.jpg`, uid)).toBe(false);
    expect(isOwnGalleryPath(`coaching/${uid}/../${other}/gallery/1.jpg`, uid)).toBe(false);
  });
  it("rejects another user's uid", () => {
    expect(isOwnGalleryPath(`coaching/${other}/gallery/1.jpg`, uid)).toBe(false);
  });
  it("rejects the wrong sub-folder", () => {
    expect(isOwnGalleryPath(`coaching/${uid}/cover/1.jpg`, uid)).toBe(false);
  });
  it("rejects a missing or unsupported extension", () => {
    expect(isOwnGalleryPath(`coaching/${uid}/gallery/1700000000000`, uid)).toBe(false);
    expect(isOwnGalleryPath(`coaching/${uid}/gallery/1.gif`, uid)).toBe(false);
  });
  it("rejects overlong input", () => {
    const huge = `coaching/${uid}/gallery/${"1".repeat(400)}.jpg`;
    expect(isOwnGalleryPath(huge, uid)).toBe(false);
  });
  it("rejects a non-string path", () => {
    expect(isOwnGalleryPath(123, uid)).toBe(false);
    expect(isOwnGalleryPath(null, uid)).toBe(false);
    expect(isOwnGalleryPath(undefined, uid)).toBe(false);
  });
});

describe("extensionForDocumentMimeType", () => {
  it("maps the three allowed document mime types to their extensions", () => {
    expect(extensionForDocumentMimeType("application/pdf")).toBe("pdf");
    expect(extensionForDocumentMimeType("image/jpeg")).toBe("jpg");
    expect(extensionForDocumentMimeType("image/png")).toBe("png");
  });
  it("returns null for anything else, including webp", () => {
    expect(extensionForDocumentMimeType("image/webp")).toBeNull();
    expect(extensionForDocumentMimeType("")).toBeNull();
  });
});

describe("checkDocumentFile", () => {
  it("accepts pdf/jpeg/png under 5 MB", () => {
    expect(checkDocumentFile({ type: "application/pdf", size: 1024 })).toEqual({ ok: true });
    expect(checkDocumentFile({ type: "image/jpeg", size: 1024 })).toEqual({ ok: true });
    expect(checkDocumentFile({ type: "image/png", size: 1024 })).toEqual({ ok: true });
  });
  it("rejects webp and other file types with a friendly message", () => {
    const r = checkDocumentFile({ type: "image/webp", size: 1024 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/pdf|jpeg|png/i);
  });
  it("rejects files over 5 MB with a friendly message", () => {
    const r = checkDocumentFile({ type: "application/pdf", size: 5 * 1024 * 1024 + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/5 ?MB/i);
  });
  it("accepts a file exactly at the 5 MB boundary", () => {
    expect(checkDocumentFile({ type: "application/pdf", size: 5 * 1024 * 1024 })).toEqual({
      ok: true,
    });
  });
});

describe("isOwnCredentialDocPath", () => {
  const uid = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  const credId = "33333333-3333-3333-3333-333333333333";
  const otherCredId = "44444444-4444-4444-4444-444444444444";
  const docUuid = "55555555-5555-5555-5555-555555555555";

  it("accepts a well-formed own credential document path for each allowed extension", () => {
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${docUuid}.pdf`, uid, credId)).toBe(true);
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${docUuid}.jpg`, uid, credId)).toBe(true);
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${docUuid}.png`, uid, credId)).toBe(true);
  });
  it("rejects path traversal", () => {
    expect(isOwnCredentialDocPath(`${uid}/${credId}/../../etc/passwd.pdf`, uid, credId)).toBe(
      false,
    );
    expect(isOwnCredentialDocPath(`${uid}/../${other}/${credId}/${docUuid}.pdf`, uid, credId)).toBe(
      false,
    );
  });
  it("rejects another user's uid", () => {
    expect(isOwnCredentialDocPath(`${other}/${credId}/${docUuid}.pdf`, uid, credId)).toBe(false);
  });
  it("rejects another credential id", () => {
    expect(isOwnCredentialDocPath(`${uid}/${otherCredId}/${docUuid}.pdf`, uid, credId)).toBe(
      false,
    );
  });
  it("rejects a missing or unsupported extension", () => {
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${docUuid}`, uid, credId)).toBe(false);
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${docUuid}.webp`, uid, credId)).toBe(false);
  });
  it("rejects overlong input via the length guard specifically", () => {
    // Every segment here is individually well-formed (valid uid, valid
    // credId, and a run of concatenated valid-looking uuid segments) so
    // the ONLY thing that can be rejecting this is the length guard, not
    // an unrelated shape mismatch. A single real uuid segment can never by
    // itself push the total past MAX_PATH_LENGTH (the fully valid form is
    // well under 200 chars), so this repeats the doc uuid many times to
    // reach the limit while keeping every individual chunk uuid-shaped.
    const longDocSegment = Array(6).fill(docUuid).join("-");
    const huge = `${uid}/${credId}/${longDocSegment}.pdf`;
    expect(huge.length).toBeGreaterThan(200);
    expect(isOwnCredentialDocPath(huge, uid, credId)).toBe(false);
  });
  it("rejects uppercase hex in the document uuid (no case-insensitive flag -- crypto.randomUUID() is always lowercase)", () => {
    // docUuid is all-digit (no a-f letters), so it round-trips through
    // .toUpperCase() unchanged -- use a uuid with actual hex letters so the
    // case-sensitivity assertion is real.
    const lowerHexDocUuid = "5a5a5a5a-5a5a-5a5a-5a5a-5a5a5a5a5a5a";
    const upperHexDocUuid = lowerHexDocUuid.toUpperCase();
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${lowerHexDocUuid}.pdf`, uid, credId)).toBe(
      true,
    );
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${upperHexDocUuid}.pdf`, uid, credId)).toBe(
      false,
    );
  });
  it("rejects a non-string path", () => {
    expect(isOwnCredentialDocPath(123, uid, credId)).toBe(false);
    expect(isOwnCredentialDocPath(null, uid, credId)).toBe(false);
    expect(isOwnCredentialDocPath(undefined, uid, credId)).toBe(false);
  });
  it("rejects a non-string credentialId", () => {
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${docUuid}.pdf`, uid, 123)).toBe(false);
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${docUuid}.pdf`, uid, null)).toBe(false);
    expect(isOwnCredentialDocPath(`${uid}/${credId}/${docUuid}.pdf`, uid, undefined)).toBe(false);
  });
  it("rejects when uid or credentialId isn't a UUID, rather than building an unanchored regex", () => {
    expect(isOwnCredentialDocPath(`not-a-uuid/${credId}/${docUuid}.pdf`, "not-a-uuid", credId)).toBe(
      false,
    );
    expect(isOwnCredentialDocPath(`${uid}/not-a-uuid/${docUuid}.pdf`, uid, "not-a-uuid")).toBe(
      false,
    );
  });
});
