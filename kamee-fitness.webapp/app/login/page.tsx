"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAADSfFsj2UkEr0f3Z";
const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
          theme?: "auto" | "light" | "dark";
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const widgetEl = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    function render() {
      if (!window.turnstile || !widgetEl.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(widgetEl.current, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        theme: "dark",
        callback: (token) => setCaptchaToken(token),
        "error-callback": () => setCaptchaToken(null),
        "expired-callback": () => setCaptchaToken(null),
      });
    }
    if (window.turnstile) {
      render();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SRC}"]`,
    );
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    return () => script?.removeEventListener("load", render);
  }, []);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaToken) {
      setMessage("Still verifying you're human — give it a moment and retry.");
      return;
    }
    setStatus("sending");
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/me`,
        captchaToken,
      },
    });
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      setCaptchaToken(null);
    }
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
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
      setMessage(error.message);
      return;
    }
    window.location.href = "/me";
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 text-mist">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="font-display text-xl font-semibold">Your Kamee stats</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in with the email on your Kamee account.
        </p>

        <form onSubmit={onSend} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-leaf-600"
          />
          <div ref={widgetEl} />
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-lg bg-leaf-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-leaf-500"
          >
            {status === "sending" ? "Sending…" : "Send magic link / code"}
          </button>
        </form>

        {status === "sent" && (
          <p className="mt-3 rounded-lg bg-leaf-950/40 px-3 py-2 text-sm text-leaf-300">
            Check your inbox — click the link, or enter the 6-digit code below.
          </p>
        )}

        <form onSubmit={onVerify} className="mt-4 space-y-2">
          <label className="block text-xs text-muted">
            Have a code from your email?
          </label>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
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

        <p className="mt-6 text-xs text-muted/70">
          New here? Create your account in the Kamee app first.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
