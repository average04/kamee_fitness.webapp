/**
 * Pure gallery-state helpers for the Coaching Hub's GalleryManager. No I/O —
 * the component calls Server Actions and Storage itself; this module only
 * knows how to merge state.
 */

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
