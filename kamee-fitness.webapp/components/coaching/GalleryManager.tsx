"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  addGalleryPhoto,
  deleteGalleryPhoto,
  reorderGallery,
  updateGalleryCaption,
} from "@/app/coaching/(hub)/actions";
import {
  createAutosaveController,
  type AutosaveController,
  type SaveState,
} from "@/lib/coaching/autosave";
import { mergeGalleryState, planGalleryUploads, type GalleryRow } from "@/lib/coaching/gallery";
import { buildPublicStorageUrl } from "@/lib/coaching/storage";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Field } from "./Field";
import { SaveIndicator } from "./SaveIndicator";

export type { GalleryRow } from "@/lib/coaching/gallery";

const MAX_PHOTOS = 12;
const MIN_RECOMMENDED = 3;

export function GalleryManager({
  coachId,
  photos: initialPhotos,
  readOnly,
}: {
  coachId: string;
  photos: GalleryRow[];
  readOnly: boolean;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const addInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllersRef = useRef<Map<string, AutosaveController<string>>>(new Map());

  const [photos, setPhotos] = useState<GalleryRow[]>(initialPhotos);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // "2 of 5" while a multi-photo selection uploads; null otherwise.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [captionStates, setCaptionStates] = useState<Record<string, SaveState>>({});
  const [captionMessages, setCaptionMessages] = useState<Record<string, string | null>>({});
  // I1 (fix round 1): ids with an unsaved (or in-flight/queued) caption
  // edit. Fed into `mergeGalleryState` below so a resync from the server
  // never overwrites text a coach is actively typing or has typed but not
  // yet durably saved.
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  // Resync with the server's truth whenever the prop identity changes --
  // after our own mutations revalidate the page, or a change lands from
  // another tab. Adjusted during render (the React-recommended way to
  // react to a prop change) rather than in an effect, since an effect that
  // only calls setState causes an extra wasted render pass. I1: merge
  // rather than replace, so a dirty tile's caption survives the resync.
  const [seenInitialPhotos, setSeenInitialPhotos] = useState(initialPhotos);
  if (initialPhotos !== seenInitialPhotos) {
    const merged = mergeGalleryState(initialPhotos, photos, dirtyIds);
    setSeenInitialPhotos(initialPhotos);
    setPhotos(merged);
  }

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      controllers.forEach((c) => c.dispose());
    };
  }, []);

  // Minor (fix round 1): same pattern as ProfileForm's beforeunload guard
  // -- warn before closing/navigating away while any caption still has an
  // unsaved edit outstanding (a pending debounce timer, a save in flight,
  // or one queued behind it).
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      const anyPending = Array.from(controllersRef.current.values()).some((c) => c.hasPending());
      if (!anyPending) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function markDirty(id: string) {
    setDirtyIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function clearDirtyIfSettled(id: string) {
    const c = controllersRef.current.get(id);
    if (c && c.hasPending()) return;
    setDirtyIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // Minor (fix round 1): dispose a tile's autosave controller (and its
  // derived state) once the tile itself is gone, instead of leaking it in
  // controllersRef for the lifetime of the page.
  function disposeCaptionController(id: string) {
    const c = controllersRef.current.get(id);
    c?.dispose();
    controllersRef.current.delete(id);
    setCaptionStates((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCaptionMessages((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDirtyIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function controllerFor(id: string): AutosaveController<string> {
    let c = controllersRef.current.get(id);
    if (!c) {
      c = createAutosaveController<string>({
        save: (caption) => updateGalleryCaption(id, caption),
        onStateChange: (s) => {
          setCaptionStates((prev) => ({ ...prev, [id]: s }));
          if (s === "saved") clearDirtyIfSettled(id);
        },
        // Minor (fix round 1): surface the server's message the same way
        // ProfileForm does, instead of only ever showing SaveIndicator's
        // generic "Couldn't save".
        onResult: (result) => {
          setCaptionMessages((prev) => ({ ...prev, [id]: result.message ?? null }));
        },
      });
      controllersRef.current.set(id, c);
    }
    return c;
  }

  function onCaptionChange(id: string, value: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption: value } : p)));
    if (readOnly) return;
    markDirty(id);
    controllerFor(id).update(value);
  }

  function onCaptionBlur(id: string, value: string) {
    if (!readOnly) controllerFor(id).saveNow(value);
  }

  /**
   * Uploads every photo in the selection, one at a time (the database caps
   * the gallery and serializes inserts per coach). Files that aren't images,
   * are too big, or don't fit under the cap are skipped with a message; a
   * failed upload doesn't stop the rest.
   */
  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0 || readOnly || photos.length >= MAX_PHOTOS) return;

    const plan = planGalleryUploads(files, coachId, photos.length, MAX_PHOTOS);
    const problems = [...plan.problems];
    setError(problems.length > 0 ? problems.join(" ") : null);
    if (plan.uploads.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: plan.uploads.length });
    const supabase = createBrowserSupabase();
    try {
      for (const [i, { file, path }] of plan.uploads.entries()) {
        const failure = await uploadOne(supabase, file, path);
        if (failure) problems.push(`${file.name}: ${failure}`);
        setProgress({ done: i + 1, total: plan.uploads.length });
      }
    } finally {
      setUploading(false);
      setProgress(null);
      setError(problems.length > 0 ? problems.join(" ") : null);
    }
    // On success the router refresh from addGalleryPhoto's revalidatePath
    // updates `initialPhotos`, which the render-time sync above merges into
    // `photos`.
  }

  /** Uploads one file and records it. Returns coach-facing failure copy, or null. */
  async function uploadOne(
    supabase: ReturnType<typeof createBrowserSupabase>,
    file: File,
    path: string,
  ): Promise<string | null> {
    try {
      const { error: uploadError } = await supabase.storage
        .from("social-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) return "Could not upload the photo. Please retry.";
      const result = await addGalleryPhoto(path);
      if (!result.message) return null;
      // The object is already in storage but no row references it --
      // best-effort cleanup so it doesn't linger as an orphan. Minor
      // (fix round 1): surface it if even that fails, but keep the real
      // (add) failure as the primary message rather than replacing it.
      let cleanupFailed = false;
      try {
        const { error: removeError } = await supabase.storage.from("social-photos").remove([path]);
        cleanupFailed = !!removeError;
      } catch {
        cleanupFailed = true;
      }
      return cleanupFailed
        ? `${result.message} (the uploaded file could not be cleaned up either.)`
        : result.message;
    } catch {
      return "Could not upload the photo. Please retry.";
    }
  }

  async function onDelete(id: string) {
    if (readOnly) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this photo?")) return;
    setError(null);
    setDeletingId(id);
    const target = photos.find((p) => p.id === id);
    try {
      const result = await deleteGalleryPhoto(id);
      if (result.message) {
        setError(result.message);
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      disposeCaptionController(id);

      const path = result.imagePath ?? target?.image_path;
      if (path) {
        // Minor (fix round 1): surface a (non-blocking) message if the
        // object removal itself fails -- the row is already gone either
        // way, so this is informational, not a reason to revert anything.
        try {
          const supabase = createBrowserSupabase();
          const { error: removeError } = await supabase.storage
            .from("social-photos")
            .remove([path]);
          if (removeError) {
            setError("Photo removed, but its file may still linger in storage.");
          }
        } catch {
          setError("Photo removed, but its file may still linger in storage.");
        }
      }
    } catch {
      setError("Could not delete the photo. Please retry.");
    } finally {
      setDeletingId(null);
    }
  }

  async function move(id: string, direction: -1 | 1) {
    if (readOnly) return;
    const idx = photos.findIndex((p) => p.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= photos.length) return;

    const previous = photos;
    const next = [...photos];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setPhotos(next);
    setError(null);
    try {
      const result = await reorderGallery(next.map((p) => p.id));
      if (result.message) {
        setError(result.message);
        setPhotos(previous);
      }
    } catch {
      setError("Could not reorder the gallery. Please retry.");
      setPhotos(previous);
    }
  }

  const addDisabled = readOnly || uploading || photos.length >= MAX_PHOTOS;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-mist">
        {photos.length} of {MAX_PHOTOS} · at least {MIN_RECOMMENDED} needed for approval
      </h2>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photos.map((p, idx) => (
          <div
            key={p.id}
            className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildPublicStorageUrl(supabaseUrl, p.image_path)}
              alt={p.caption ?? ""}
              className="aspect-square w-full rounded-lg object-cover"
            />
            <Field label="Caption" error={captionMessages[p.id] ?? undefined}>
              <input
                className="w-full rounded-md border border-white/10 bg-ink-900 px-2 py-1 text-xs outline-none focus:border-leaf-600 disabled:opacity-60"
                maxLength={120}
                value={p.caption ?? ""}
                disabled={readOnly}
                onChange={(e) => onCaptionChange(p.id, e.target.value)}
                onBlur={(e) => onCaptionBlur(p.id, e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between gap-1">
              <SaveIndicator
                state={captionStates[p.id] ?? "idle"}
                onRetry={() => controllerFor(p.id).saveNow(p.caption ?? "")}
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(p.id, -1)}
                  disabled={readOnly || idx === 0}
                  aria-label={`Move photo ${idx + 1} up`}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-xs text-muted hover:text-mist disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(p.id, 1)}
                  disabled={readOnly || idx === photos.length - 1}
                  aria-label={`Move photo ${idx + 1} down`}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-xs text-muted hover:text-mist disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  disabled={readOnly || deletingId === p.id}
                  aria-label={`Delete photo ${idx + 1}`}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {deletingId === p.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/*
          I3 (fix round 1): the file input is `sr-only` (present, focusable,
          keyboard-operable) rather than `hidden` (removed from the tab
          order entirely), rendered BEFORE the label so its
          `peer-focus-visible:*` classes react to the input's own focus.
        */}
        <input
          id={addInputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="peer sr-only"
          disabled={addDisabled}
          onChange={onFileChange}
        />
        <label
          htmlFor={addInputId}
          className={
            (addDisabled
              ? "flex aspect-square cursor-not-allowed items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-xs text-muted/50"
              : "flex aspect-square cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/20 text-center text-xs text-muted hover:border-leaf-600 hover:text-mist") +
            " peer-focus-visible:ring-2 peer-focus-visible:ring-leaf-600 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-950"
          }
        >
          {uploading
            ? progress && progress.total > 1
              ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
              : "Uploading…"
            : photos.length >= MAX_PHOTOS
              ? "12 of 12"
              : "+ Add photos"}
        </label>
      </div>
    </div>
  );
}
