"use client";

import { useState, useTransition } from "react";
import { verifyCredential } from "@/app/admin/(panel)/coaches/actions";
import type { CredentialEvidence } from "@/lib/coaching/admin";

/**
 * Verify control for one credential row. `expected` is exactly what the
 * page rendered for this row (I1, fix round 1) -- the server re-reads the
 * credential fresh and refuses to verify if anything differs from what the
 * admin actually looked at, closing the window between page load and click.
 */
export function VerifyCredentialButton({
  id,
  initialVerified,
  expected,
  disabledReason,
}: {
  id: string;
  initialVerified: boolean;
  expected: CredentialEvidence;
  /** M2 (fix round 1): set when this row's document exists but its signed URL failed to generate -- disables Verify with an explanatory hint instead of silently allowing a verify with no way to review the document. */
  disabledReason?: string;
}) {
  const [verified, setVerified] = useState(initialVerified);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // M3 (fix round 1): every successful verify (and every coach edit that
  // clears verification server-side) revalidates this page, so the
  // displayed state must always follow the fresh `initialVerified` prop
  // rather than staying pinned to whatever this component last set
  // optimistically. Adjusted during render (React's documented pattern for
  // resetting state from a changed prop) rather than in a useEffect, which
  // would call setState synchronously in an effect body and force an extra
  // render.
  const [prevInitialVerified, setPrevInitialVerified] = useState(initialVerified);
  if (initialVerified !== prevInitialVerified) {
    setPrevInitialVerified(initialVerified);
    setVerified(initialVerified);
  }

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await verifyCredential(id, expected);
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

  const disabled = verified || pending || !!disabledReason;

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={disabledReason}
        className="rounded-lg border border-emerald-700 px-2.5 py-1 text-xs font-medium text-emerald-400 enabled:hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {verified ? "Verified" : pending ? "Verifying…" : "Verify"}
      </button>
      {disabledReason && !verified && (
        <span className="text-xs text-amber-500">{disabledReason}</span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
