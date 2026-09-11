import { describe, expect, it } from "vitest";
import { mergeGalleryState, type GalleryRow } from "./gallery";

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
