"use client";

import { useState, useTransition } from "react";
import { searchCoachCandidate } from "@/app/admin/(panel)/coaches/actions";
import type { InviteCandidate } from "@/app/admin/(panel)/coaches/queries";
import { isInvitable } from "@/lib/coaching/admin";
import { InviteBlock } from "./InviteBlock";

type SearchState = {
  searched: string;
  candidate: InviteCandidate | null;
  capped: boolean;
};

/**
 * M6 (fix round 1): search-by-username-or-email now runs as a POST Server
 * Action instead of a GET `?q=` search param, so an admin's search (which
 * can be an email address) never lands in the browser's URL bar, history,
 * or a referrer header, and so revalidating the page (e.g. after sending
 * an invite) never silently re-triggers the scan.
 */
export function CoachSearch() {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchState | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await searchCoachCandidate(q);
        if (res.ok) {
          setResult({ searched: q, candidate: res.candidate ?? null, capped: !!res.capped });
        } else {
          setResult(null);
          setError(res.error ?? "Search failed. Please try again.");
        }
      } catch {
        setResult(null);
        setError("Search failed. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username or email…"
          aria-label="Search by username or email"
          className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result?.capped && (
        <p className="text-sm text-amber-400">
          Search stopped after 4,000 users — try the exact email or username.
        </p>
      )}

      {result && !result.candidate && (
        <p className="text-sm text-zinc-500">
          No user found for &quot;{result.searched}&quot;.
        </p>
      )}

      {result?.candidate && (
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div>
            <p className="text-sm text-zinc-200">
              {result.candidate.display_name ?? result.candidate.username ?? result.candidate.id}
            </p>
            {result.candidate.username && (
              <p className="text-xs text-zinc-500">@{result.candidate.username}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">status: {result.candidate.coach_status}</p>
          </div>
          {isInvitable(result.candidate.role, result.candidate.coach_status) ? (
            <InviteBlock
              userId={result.candidate.id}
              label={result.candidate.coach_status === "invited" ? "Resend" : "Invite"}
            />
          ) : result.candidate.role === "admin" ? (
            <p className="text-xs text-zinc-500">Admins cannot be coaches.</p>
          ) : (
            <p className="text-xs text-zinc-500">
              Already past the invite stage — open their profile below.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
