"use client";

import { useEffect } from "react";

/**
 * Segment-level error boundary for everything under /coaching (invite
 * pages, not-a-coach, and the hub layout + its pages). C1 (fix round 1):
 * without this, any thrown error here (e.g. loadHub's now-thrown query
 * errors, or a rejected Server Action) fell back to the root error page,
 * which uses the wrong visual language for a public-token surface.
 */
export default function CoachingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 text-mist">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          We hit a snag loading the Coaching Hub. You can try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-block rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-500"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
