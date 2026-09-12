import { describe, expect, it } from "vitest";
import { mergeGalleryState, planGalleryUploads, type GalleryRow } from "./gallery";
import { isOwnGalleryPath } from "./storage";

function row(over: Partial<GalleryRow> = {}): GalleryRow {
  return {
    id: "p1",
    image_path: "coaching/u1/gallery/1.jpg",
    caption: "old",
    position: 0,
    ...over,
  };
}

describe("mergeGalleryState", () => {
  it("takes the server's caption for a clean (non-dirty) row", () => {
    const server = [row({ caption: "server value" })];
    const local = [row({ caption: "server value" })];
    expect(mergeGalleryState(server, local, new Set())).toEqual(server);
  });

  it("keeps the local caption for a dirty row even when the server value differs", () => {
    const server = [row({ caption: "server value" })];
    const local = [row({ caption: "typing…" })];
    expect(mergeGalleryState(server, local, new Set(["p1"]))).toEqual([
      row({ caption: "typing…" }),
    ]);
  });

  it("still follows the server for non-caption fields on a dirty row", () => {
    const server = [row({ caption: "server value", position: 3, image_path: "new/path.jpg" })];
    const local = [row({ caption: "typing…", position: 0, image_path: "old/path.jpg" })];
    expect(mergeGalleryState(server, local, new Set(["p1"]))).toEqual([
      { id: "p1", image_path: "new/path.jpg", caption: "typing…", position: 3 },
    ]);
  });

  it("follows the server's row set even for a dirty id the server no longer has", () => {
    const server = [row({ id: "p2", caption: "new photo" })];
    const local = [row({ id: "p1", caption: "typing…" })];
    expect(mergeGalleryState(server, local, new Set(["p1"]))).toEqual(server);
  });

  it("adds a server row with no local counterpart as-is, dirty or not", () => {
    const server = [row({ id: "p1" }), row({ id: "p2", caption: "brand new" })];
    const local = [row({ id: "p1" })];
    expect(mergeGalleryState(server, local, new Set(["p2"]))).toEqual(server);
  });

  it("is a no-op when nothing is dirty and server already matches local", () => {
    const server = [row()];
    expect(mergeGalleryState(server, server, new Set())).toEqual(server);
  });

  it("handles an empty dirty set and an empty row list", () => {
    expect(mergeGalleryState([], [], new Set())).toEqual([]);
  });
});

describe("planGalleryUploads", () => {
  const uid = "11111111-1111-4111-8111-111111111111";
  const img = (name: string, type = "image/jpeg", size = 1000) => ({ name, type, size });

  it("plans every valid file with a unique path the server accepts", () => {
    const { uploads, problems } = planGalleryUploads([img("a.jpg"), img("b.png", "image/png"), img("c.webp", "image/webp")], uid, 0, 12, 1700000000000);
    expect(problems).toEqual([]);
    expect(uploads.map((u) => u.path)).toEqual([
      `coaching/${uid}/gallery/170000000000000.jpg`,
      `coaching/${uid}/gallery/170000000000001.png`,
      `coaching/${uid}/gallery/170000000000002.webp`,
    ]);
    for (const u of uploads) expect(isOwnGalleryPath(u.path, uid)).toBe(true);
  });

  it("skips wrong types and oversize files, and says which", () => {
    const { uploads, problems } = planGalleryUploads([img("doc.pdf", "application/pdf"), img("big.jpg", "image/jpeg", 6 * 1024 * 1024), img("ok.jpg")], uid, 0, 12);
    expect(uploads.map((u) => u.file.name)).toEqual(["ok.jpg"]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^doc\.pdf: /);
    expect(problems[1]).toMatch(/^big\.jpg: .*5 MB/);
  });

  it("stops at the gallery cap and reports how many were left out", () => {
    const files = [img("1.jpg"), img("2.jpg"), img("3.jpg"), img("4.jpg")];
    const { uploads, problems } = planGalleryUploads(files, uid, 10, 12);
    expect(uploads.map((u) => u.file.name)).toEqual(["1.jpg", "2.jpg"]);
    expect(problems).toEqual(["The gallery holds 12 photos, so 2 photos were not added."]);
  });

  it("plans nothing when the gallery is already full", () => {
    const { uploads, problems } = planGalleryUploads([img("1.jpg")], uid, 12, 12);
    expect(uploads).toEqual([]);
    expect(problems).toEqual(["The gallery holds 12 photos, so 1 photo was not added."]);
  });
});
