/**
 * Pure gallery-state helpers for the Coaching Hub's GalleryManager. No I/O —
 * the component calls Server Actions and Storage itself; this module only
 * knows how to merge state and plan uploads.
 */

import { checkImageFile, extensionForMimeType } from "./storage";

export type GalleryRow = {
  id: string;
  image_path: string;
  caption: string | null;
  position: number;
};

/**
 * Merge a freshly revalidated server row list into the client's current
 * local state without clobbering an unsaved caption edit.
 *
 * I1 (fix round 1): GalleryManager keeps its own `photos` state so tiles can
 * be optimistically reordered/added/removed instantly, and resyncs from the
 * `photos` prop whenever the server round-trips fresh data (after any of
 * our own mutations revalidate the page, or a change lands from another
 * browser tab). Naively replacing local state with the server's rows on
 * every such resync would silently overwrite whatever caption text a coach
 * is currently typing (or has typed but not yet durably saved) the instant
 * an unrelated mutation (add/delete/reorder) revalidates the page.
 *
 * `dirtyIds` names every row whose local caption must NOT be clobbered --
 * the caller tracks this (a caption becomes dirty the moment it's edited,
 * and clean again only once that exact value is durably saved with no
 * further edit queued behind it). Everything else about a row (image_path,
 * position, and the row set itself -- additions/removals) always follows
 * the server, since only captions are optimistically edited client-side.
 */
export function mergeGalleryState(
  server: GalleryRow[],
  local: GalleryRow[],
  dirtyIds: ReadonlySet<string>,
): GalleryRow[] {
  const localById = new Map(local.map((row) => [row.id, row]));
  return server.map((row) => {
    if (!dirtyIds.has(row.id)) return row;
    const localRow = localById.get(row.id);
    return localRow ? { ...row, caption: localRow.caption } : row;
  });
}

/** One file the gallery will upload, with its storage path already chosen. */
export type PlannedUpload<F> = { file: F; path: string };

/**
 * Turns a multi-file selection into an upload plan: skips files that aren't
 * a JPEG/PNG/WEBP under 5 MB, stops at the gallery cap, and gives each file
 * its own path (`coaching/<uid>/gallery/<digits>.<ext>`, the shape
 * isOwnGalleryPath and the database accept -- digits only, so a per-file
 * two-digit suffix keeps paths unique within one selection). `problems` is
 * coach-facing copy for everything that was left out.
 */
export function planGalleryUploads<F extends { name: string; type: string; size: number }>(
  files: readonly F[],
  coachId: string,
  currentCount: number,
  max: number,
  now: number = Date.now(),
): { uploads: PlannedUpload<F>[]; problems: string[] } {
  const slots = Math.max(0, max - currentCount);
  const uploads: PlannedUpload<F>[] = [];
  const problems: string[] = [];
  let overCap = 0;
  files.forEach((file, i) => {
    const check = checkImageFile(file);
    const ext = extensionForMimeType(file.type);
    if (!check.ok || !ext) {
      problems.push(`${file.name}: ${check.ok ? "Please choose a JPEG, PNG, or WEBP image." : check.message}`);
      return;
    }
    if (uploads.length >= slots) {
      overCap++;
      return;
    }
    uploads.push({ file, path: `coaching/${coachId}/gallery/${now}${String(i).padStart(2, "0")}.${ext}` });
  });
  if (overCap > 0) {
    problems.push(
      `The gallery holds ${max} photos, so ${overCap} ${overCap === 1 ? "photo was" : "photos were"} not added.`,
    );
  }
  return { uploads, problems };
}
