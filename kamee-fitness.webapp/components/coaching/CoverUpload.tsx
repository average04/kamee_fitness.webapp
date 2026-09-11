"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { setCoverPath } from "@/app/coaching/(hub)/actions";
import {
  buildCoverPath,
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
}: {
  userId: string;
  current: string | null;
  readOnly: boolean;
}) {
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
      const result = await setCoverPath(path);
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
      setError("Could not save the cover. Please retry.");
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
    const path = buildCoverPath(userId, ext);
    try {
      const supabase = createBrowserSupabase();
      const { error: uploadError } = await supabase.storage
        .from("social-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setState("error");
        setError("Could not upload the cover photo. Please retry.");
        setLastFile(file);
        revertPreview();
        return;
      }
    } catch {
      setState("error");
      setError("Could not upload the cover photo. Please retry.");
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
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="block text-sm font-semibold text-mist">
          Cover photo
        </label>
        <SaveIndicator state={state} onRetry={retry} />
      </div>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Cover preview"
          className="h-40 w-full rounded-lg border border-white/10 object-cover"
        />
      )}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={readOnly || state === "saving"}
        onChange={onChange}
        className="block text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-mist disabled:opacity-60"
      />
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
