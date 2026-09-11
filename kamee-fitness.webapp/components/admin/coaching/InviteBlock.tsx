"use client";

import { useState, useTransition } from "react";
import { inviteCoach } from "@/app/admin/(panel)/coaches/actions";

/**
 * Invite / Resend control shown on the coaches list search result and the
 * coach detail page. After a call it shows the invite URL in a copy box
 * plus whether the email actually went out (Resend can be unconfigured in
 * some environments -- `emailed: false` just means "copy the link" instead
 * of an error).
 */
export function InviteBlock({
  userId,
  label,
}: {
  userId: string;
  label: "Invite" | "Resend";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await inviteCoach(userId);
        if (res.ok && res.url) {
          setResult({ url: res.url, emailed: !!res.emailed });
        } else {
          setError(res.error ?? "Could not send the invite. Please try again.");
        }
      } catch {
        setError("Could not send the invite. Please try again.");
      }
    });
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser -- the URL is still
      // selectable text in the box below, so this is a soft failure.
      setError("Could not copy automatically -- select and copy the link below.");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Sending…" : label}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <p className="text-xs font-medium text-zinc-400">
            {result.emailed ? "Email sent" : "Email not sent — copy the link"}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={result.url}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 outline-none"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
