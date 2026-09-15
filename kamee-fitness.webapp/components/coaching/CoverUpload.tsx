"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { setCoverPath, setAvatarPath } from "@/app/coaching/(hub)/actions";
import {
  buildCoverPath,
  buildAvatarPath,
  buildPublicStorageUrl,
  checkImageFile,
  extensionForMimeType,
} from "@/lib/coaching/storage";
import type { SaveState } from "@/lib/coaching/autosave";
import { SaveIndicator } from "./SaveIndicator";

export function CoverUpload({
  userId,
  current,
  readOnly,
  kind = "cover",
}: {
  userId: string;
  current: string | null;
  readOnly: boolean;
  kind?: "cover" | "avatar";
}) {
  const photoLabel = kind === "avatar" ? "Profile photo" : "Cover photo";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const initialPreview = current ? buildPublicStorageUrl(supabaseUrl, current) : null;
  const confirmedPreviewRef = useRef<string | null>(initialPreview);
  const [preview, setPreview] = useState<string | null>(initialPreview);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  // Set once the storage upload succeeds but setCoverPath then fails -- the
  // file is already in the bucket, so a retry should only replay the
  // (cheap) DB write, never re-upload the same bytes (M9, fix round 1).
  const [pendingCoverPath, setPendingCoverPath] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function showObjectPreview(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreview(url);
  }

  function revertPreview() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreview(confirmedPreviewRef.current);
  }

  async function finishSetCoverPath(path: string) {
    // Fix round 2 (new Important): a rejected setCoverPath call (network
    // failure, transport error -- not just a FormState carrying `message`)
    // previously left `state` stuck at "saving" and the file input disabled
    // forever, since nothing downstream of the throw ever ran.
    try {
      const result = await (kind === "avatar" ? setAvatarPath(path) : setCoverPath(path));
      if (result.message) {
        setState("error");
        setError(result.message);
        setPendingCoverPath(path);
        revertPreview();
        return;
      }
      setState("saved");
      setError(null);
      setPendingCoverPath(null);
      setLastFile(null);
      confirmedPreviewRef.current = buildPublicStorageUrl(supabaseUrl, path);
      setPreview(confirmedPreviewRef.current);
    } catch {
      setState("error");
      setError("Could not save the photo. Please retry.");
      // The storage upload already succeeded (this function only runs
      // after that) -- retry should replay setCoverPath only, never
      // re-upload the same bytes.
      setPendingCoverPath(path);
      revertPreview();
    }
  }

  async function uploadAndSave(file: File) {
    setError(null);
    setState("saving");
    showObjectPreview(file);

    const ext = extensionForMimeType(file.type);
    if (!ext) {
      // checkImageFile already gates this on selection; defensive only.
      setState("error");
      setError("Please choose a JPEG, PNG, or WEBP image.");
      revertPreview();
      return;
    }
    const path = kind === "avatar" ? buildAvatarPath(userId, ext) : buildCoverPath(userId, ext);
    try {
      const supabase = createBrowserSupabase();
      const { error: uploadError } = await supabase.storage
        .from("social-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setState("error");
        setError("Could not upload the photo. Please retry.");
        setLastFile(file);
        revertPreview();
        return;
      }
    } catch {
      setState("error");
      setError("Could not upload the photo. Please retry.");
      setLastFile(file);
      revertPreview();
      return;
    }
    await finishSetCoverPath(path);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (readOnly) return; // I2 (fix round 1): never upload while the profile is read-only.

    const check = checkImageFile(file);
    if (!check.ok) {
      setError(check.message);
      // M9 remainder (fix round 2): a rejected file must not leave a stale
      // "Saved" sitting next to the new error -- drop back to idle.
      setState("idle");
      // Reset the native input so re-selecting the same (rejected) file
      // fires onChange again instead of being silently ignored.
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPendingCoverPath(null);
    setLastFile(file);
    void uploadAndSave(file);
  }

  function retry() {
    if (readOnly) return;
    if (pendingCoverPath) {
      setError(null);
      setState("saving");
      void finishSetCoverPath(pendingCoverPath);
      return;
    }
    if (lastFile) void uploadAndSave(lastFile);
  }

  return (
    <div className="space-y-2 coach-panel">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="block text-sm font-semibold text-mist">
          {photoLabel} <span className="font-normal text-mist/60">(optional)</span>
        </label>
        <SaveIndicator state={state} onRetry={retry} />
      </div>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={`${photoLabel} preview`}
          className={kind === "avatar" ? "h-32 w-32 rounded-full object-cover" : "coach-cover-preview"}
        />
      )}
      {!preview && <div className="coach-cover-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>
        <p>Add a {photoLabel.toLowerCase()}</p>
      </div>}
      <p className="coach-panel-description">JPEG, PNG or WebP. Up to 5 MB.</p>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={readOnly || state === "saving"}
        onChange={onChange}
        className="coach-file"
      />
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
