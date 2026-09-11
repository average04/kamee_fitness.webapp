"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { setCoverPath } from "@/app/coaching/(hub)/actions";
import { buildCoverPath, buildPublicStorageUrl, checkImageFile } from "@/lib/coaching/storage";
import type { SaveState } from "@/lib/coaching/autosave";
import { SaveIndicator } from "./SaveIndicator";

export function CoverUpload({
  userId,
  current,
}: {
  userId: string;
  current: string | null;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const [preview, setPreview] = useState<string | null>(
    current ? buildPublicStorageUrl(supabaseUrl, current) : null,
  );
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  async function upload(file: File) {
    setError(null);
    setState("saving");
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const path = buildCoverPath(userId);
    const supabase = createBrowserSupabase();
    const { error: uploadError } = await supabase.storage
      .from("social-photos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setState("error");
      setError("Could not upload the cover photo. Please retry.");
      return;
    }

    const result = await setCoverPath(path);
    if (result.message) {
      setState("error");
      setError(result.message);
      return;
    }
    setState("saved");
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = checkImageFile(file);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setLastFile(file);
    void upload(file);
  }

  function retry() {
    if (lastFile) void upload(lastFile);
  }

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-mist">Cover photo</label>
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
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onChange}
        className="block text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-mist"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
