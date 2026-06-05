"use client";

import { useState, useTransition } from "react";

/**
 * Inline editor for an exercise's demo video (YouTube) URL in the list table.
 * Saves on blur / Enter via the passed server action, and offers an ↗ link
 * that opens the current URL in a new tab.
 */
export function VideoUrlCell({
  id,
  initialUrl,
  onSave,
}: {
  id: string;
  initialUrl: string | null;
  onSave: (id: string, url: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saved, setSaved] = useState((initialUrl ?? "").trim());
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  function commit() {
    const next = url.trim();
    if (next === saved) return; // unchanged — skip the write
    startTransition(async () => {
      const res = await onSave(id, next);
      if (res.ok) {
        setSaved(next);
        setStatus("saved");
      } else {
        setStatus("error");
      }
    });
  }

  const openHref = url.trim();

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setStatus("idle");
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur(); // triggers onBlur -> commit
          }
        }}
        placeholder="YouTube URL"
        aria-label="Demo video URL"
        className="w-44 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs outline-none focus:border-emerald-600"
      />
      {openHref ? (
        <a
          href={openHref}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          aria-label="Open video in new tab"
          className="text-emerald-400 hover:text-emerald-300"
        >
          ↗
        </a>
      ) : (
        <span className="text-zinc-700">↗</span>
      )}
      <span className="w-3 text-center text-xs">
        {pending ? (
          <span className="text-zinc-500">…</span>
        ) : status === "saved" ? (
          <span className="text-emerald-500" title="Saved">
            ✓
          </span>
        ) : status === "error" ? (
          <span className="text-red-400" title="Save failed">
            !
          </span>
        ) : null}
      </span>
    </div>
  );
}
