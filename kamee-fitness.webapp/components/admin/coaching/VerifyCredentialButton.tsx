"use client";

import { useState, useTransition } from "react";
import { verifyCredential } from "@/app/admin/(panel)/coaches/actions";

/**
 * Verify control for one credential row. Disabled once verified -- the
 * server clears `is_verified` automatically whenever the coach edits the
 * credential's evidence (title/issuer/year/expiry/document), so a
 * still-verified row genuinely has nothing left to do here.
 */
export function VerifyCredentialButton({
  id,
  initialVerified,
}: {
  id: string;
  initialVerified: boolean;
}) {
  const [verified, setVerified] = useState(initialVerified);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await verifyCredential(id);
        if (res.ok) {
          setVerified(true);
        } else {
          setError(res.error ?? "Could not verify. Please try again.");
        }
      } catch {
        setError("Could not verify. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={verified || pending}
        className="rounded-lg border border-emerald-700 px-2.5 py-1 text-xs font-medium text-emerald-400 enabled:hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {verified ? "Verified" : pending ? "Verifying…" : "Verify"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
