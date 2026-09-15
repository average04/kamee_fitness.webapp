"use client";

import { useId, useRef, useState, useTransition } from "react";
import { CoachSearch } from "./CoachSearch";
import { RequiredMark } from "@/components/RequiredMark";
import { inviteCoachByEmail, type InviteResult } from "@/app/admin/(panel)/coaches/actions";

export function InviteCoachDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  function send(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setCopied(false);
    startTransition(async () => {
      try { setResult(await inviteCoachByEmail(email)); }
      catch { setResult({ ok: false, error: "Could not send the invitation. Please try again." }); }
    });
  }
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14" /></svg>
        Invite a coach
      </button>
      <dialog ref={dialog} aria-labelledby={titleId} onCancel={(e) => { if (pending) e.preventDefault(); }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 text-zinc-100 shadow-xl backdrop:bg-black/70 sm:p-8">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold">Invite a coach</h2>
          <button type="button" disabled={pending} aria-label="Close invitation" onClick={() => dialog.current?.close()}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 6 12 12M6 18 18 6" /></svg>
          </button>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-zinc-400">Send them a link to sign in and set up their coach profile. They don’t need a Kamee account yet.</p>
        <form onSubmit={send} className="space-y-3">
          <p className="text-xs text-zinc-400">* Required</p>
          <label htmlFor={emailId} className="block text-sm font-medium">Coach’s email address<RequiredMark /></label>
          <input id={emailId} type="email" required maxLength={254} autoComplete="email" value={email} disabled={pending}
            onChange={(e) => { setEmail(e.target.value); setResult(null); }} placeholder="coach@example.com"
            className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-base focus:outline-2 focus:outline-emerald-400" />
          <p className="text-xs leading-relaxed text-zinc-400">They’ll verify this email before onboarding. The invitation is valid for 14 days. Sending again replaces their previous invitation.</p>
          <button type="submit" disabled={pending} className="min-h-11 w-full rounded-lg bg-emerald-600 px-4 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50">{pending ? "Sending invitation…" : "Send invitation"}</button>
        </form>
        {result?.error && <p role="alert" className="mt-4 text-sm text-red-300">{result.error}</p>}
        {result?.ok && result.url && <div role="status" className="mt-5 space-y-3 rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">
          <p className="text-sm text-emerald-300">{result.emailed ? "Invitation emailed. They can start onboarding from the link." : "Invitation created. Email wasn’t sent—copy and share the link below."}</p>
          <input aria-label="Coach onboarding link" readOnly value={result.url} onFocus={(e) => e.target.select()} className="min-h-11 w-full rounded border border-zinc-700 bg-zinc-950 px-3 text-xs" />
          <button type="button" className="min-h-11 rounded-lg border border-emerald-700 px-4 text-sm" onClick={async () => { try { await navigator.clipboard.writeText(result.url!); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy invitation link"}</button>
        </div>}
        <details className="mt-6 border-t border-zinc-800 pt-4"><summary className="cursor-pointer py-2 text-sm text-zinc-400">Find an existing account by username</summary><div className="mt-3"><CoachSearch /></div></details>
      </dialog>
    </>
  );
}
