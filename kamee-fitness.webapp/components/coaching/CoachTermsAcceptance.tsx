"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { acceptCoachTerms } from "@/app/coaching/(hub)/actions";
import type { CoachTermsState } from "@/lib/coaching/terms";
import { COACH_TERMS_PATH } from "@/lib/legal-version";

// UTC with a fixed locale so the server render and the hydrated client agree.
const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const fmt = (iso: string) => `${dateFmt.format(new Date(iso))} (UTC)`;

/**
 * Coach Terms acceptance, separate from the profile autosave. Acceptance is
 * an explicit action: the coach ticks the box and presses Accept, and the
 * database records the time and the version (acceptCoachTerms ->
 * accept_coaching_terms). Nothing here writes the acceptance columns.
 * Stays usable while the profile is in review: accepting terms does not
 * change the content under review.
 */
export function CoachTermsAcceptance({ state }: { state: CoachTermsState }) {
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const termsLink = (
    <Link href={COACH_TERMS_PATH} target="_blank" className="text-leaf-500 underline hover:text-leaf-400">
      Coach Terms
    </Link>
  );

  if (state.kind === "unavailable") {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold">Coach terms</h2>
        <p className="mt-1 text-sm text-muted">
          The {termsLink}{" "}are being finalised. You can keep building your profile; you&apos;ll be
          asked to accept them before you submit.
        </p>
      </section>
    );
  }

  if (state.kind === "accepted") {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold">Coach terms</h2>
        <p className="mt-1 text-sm text-muted">
          You accepted the {termsLink}{" "}(version {state.version}) on {fmt(state.acceptedAt)}.
        </p>
      </section>
    );
  }

  function onAccept() {
    if (state.kind !== "needs_acceptance") return;
    const version = state.version;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await acceptCoachTerms(version);
        if (result.message) setMessage(result.message);
      } catch {
        setMessage("Could not record your acceptance. Please retry.");
      }
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div>
        <h2 className="text-sm font-semibold">Coach terms</h2>
        {state.previous ? (
          <p className="mt-1 text-sm text-muted">
            The {termsLink}{" "}have been updated to version {state.version}. Please read and accept
            them again
            {state.previous.version ? ` (you accepted version ${state.previous.version})` : ""}.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Read the {termsLink}{" "}(version {state.version}) and accept them before you submit your
            profile.
          </p>
        )}
      </div>
      <label className="flex items-start gap-2 text-sm text-mist">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={agreed}
          disabled={pending}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>I have read and agree to the Coach Terms, version {state.version}.</span>
      </label>
      <button
        type="button"
        onClick={onAccept}
        disabled={!agreed || pending}
        className="rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-500 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Accept coach terms"}
      </button>
      {message && (
        <p role="alert" className="text-sm text-red-400">
          {message}
        </p>
      )}
    </section>
  );
}
