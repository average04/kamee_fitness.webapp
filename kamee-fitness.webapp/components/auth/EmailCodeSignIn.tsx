"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { safeNextPath } from "@/lib/safe-next";
import { signInErrorMessage } from "@/lib/auth/sign-in-errors";
import { isLocalDevelopmentAuth } from "@/lib/auth/local-auth";
import { startTurnstileVerification, type VerificationState } from "@/lib/auth/turnstile-verification";
import { RequiredMark } from "@/components/RequiredMark";

function usesLocalAuth() {
  return isLocalDevelopmentAuth(process.env.NODE_ENV, window.location.origin, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAADSfFsj2UkEr0f3Z";

/**
 * Email one-time-code sign-in (existing accounts only), shared by /login and
 * the coach invite page. Sends a magic link + 6-digit code; the link lands on
 * /auth/callback?next=..., the code signs in on this page. Either way the
 * visitor ends up at `next` (same-origin only, via safeNextPath).
 */
export function EmailCodeSignIn({
  next,
  fallbackNext = "/me",
  sendLabel = "Send magic link / code",
  theme = "dark",
  invitedEmail,
}: {
  next: string | null;
  fallbackNext?: string;
  sendLabel?: string;
  theme?: "light" | "dark";
  invitedEmail?: string;
}) {
  // Resolved lazily (not at render time) because it needs window.location.origin,
  // which is unavailable during this client component's server-side render pass.
  function resolveNext(): string {
    return safeNextPath(next, window.location.origin, fallbackNext);
  }
  const emailId = useId();
  const codeId = useId();
  const [enteredEmail, setEmail] = useState("");
  const email = invitedEmail ?? enteredEmail;
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const widgetEl = useRef<HTMLDivElement>(null);
  const verificationSession = useRef<ReturnType<typeof startTurnstileVerification> | null>(null);

  useEffect(() => {
    if (usesLocalAuth()) return;
    if (!widgetEl.current) return;
    const session = startTurnstileVerification(widgetEl.current, {
      sitekey: TURNSTILE_SITE_KEY, hostname: window.location.hostname, theme, onChange: setVerification,
    });
    verificationSession.current = session;
    return () => {
      session.dispose();
      if (verificationSession.current === session) verificationSession.current = null;
    };
  }, [theme, verificationAttempt]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const usesLocal = usesLocalAuth();
    const captchaToken = verificationSession.current?.consumeToken();
    if (!captchaToken && !usesLocal) {
      setMessage(verification?.phase === "error" ? verification.message : "Complete verification before requesting your sign-in email.");
      return;
    }
    setStatus("sending");
    setMessage(null);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(resolveNext())}`,
          captchaToken: captchaToken ?? undefined,
        },
      });
      if (error) {
        setStatus("error");
        setMessage(signInErrorMessage(error.message));
      } else {
        setStatus("sent");
      }
    } catch {
      setStatus("error");
      setMessage("Could not request your sign-in email. Check your connection and retry.");
    } finally {
      if (!usesLocal) setVerificationAttempt((value) => value + 1);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setVerifying(false);
      setMessage(signInErrorMessage(error.message));
      return;
    }
    window.location.href = resolveNext();
  }

  return (
    <>
      <form onSubmit={onSend} className="mt-6 space-y-3">
        <p className="text-xs text-muted">* Required</p>
        <label htmlFor={emailId} className="block text-sm font-medium">Email address<RequiredMark /></label>
        <input
          id={emailId}
          type="email"
          required
          readOnly={!!invitedEmail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-leaf-600"
        />
        <div ref={widgetEl} />
        {verification && (
          <div className="space-y-2">
            <p role={verification.phase === "error" ? "alert" : "status"} aria-live="polite" className={`text-sm ${verification.phase === "error" ? "text-red-400" : "text-muted"}`}>
              {verification.message}
            </p>
            {verification.phase === "error" && (
              <button type="button" disabled={status === "sending"} onClick={() => { setMessage(null); setVerificationAttempt((value) => value + 1); }} className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-50">
                Retry verification
              </button>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={status === "sending" || (!!verification && verification.phase !== "verified")}
          className="w-full rounded-lg bg-leaf-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-leaf-500"
        >
          {status === "sending" ? "Sending…" : sendLabel}
        </button>
      </form>

      {status === "sent" && (
        <p className="mt-3 rounded-lg bg-leaf-950/40 px-3 py-2 text-sm text-leaf-300">
          Check your inbox — click the link, or enter the 6-digit code below.
        </p>
      )}

      <form onSubmit={onVerify} className="mt-4 space-y-2">
        <label htmlFor={codeId} className="block text-xs text-muted">Email code<RequiredMark /> <span className="font-normal">(if signing in with a code)</span></label>
        <div className="flex gap-2">
          <input
            id={codeId}
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="w-32 rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm tracking-widest outline-none focus:border-leaf-600"
          />
          <button
            type="submit"
            disabled={verifying || code.length < 6}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-50"
          >
            {verifying ? "Verifying…" : "Verify code"}
          </button>
        </div>
      </form>

      {message && <p className="mt-3 text-sm text-red-400">{message}</p>}
    </>
  );
}
