"use client";

import { useState } from "react";

/**
 * Demo-image picker. Shows the current image (via its public URL) with a
 * "remove" checkbox, and a file input named `image` for a replacement. The
 * server action uploads the file and sets `demo_image_path`.
 */
export function ImageUploadField({
  currentPath,
}: {
  currentPath: string | null;
}) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Stored path is `exercise-demos/<file>`; the bucket is also `exercise-demos`,
  // so the public object URL is /storage/v1/object/public/<stored-path>.
  const currentUrl =
    currentPath && base
      ? `${base}/storage/v1/object/public/${currentPath}`
      : null;
  const [preview, setPreview] = useState<string | null>(currentUrl);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-zinc-300">Demo image</label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Demo preview"
          className="h-32 w-32 rounded-lg border border-zinc-800 object-cover"
        />
      )}
      <input
        type="file"
        name="image"
        accept="image/png,image/jpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setPreview(file ? URL.createObjectURL(file) : currentUrl);
        }}
        className="block text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-100"
      />
      {currentPath && (
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" name="remove_image" />
          Remove current image
        </label>
      )}
    </div>
  );
}
