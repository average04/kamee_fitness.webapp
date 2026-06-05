"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

// Public Turnstile site key — ships in the client bundle by design (same key
// the mobile app uses). Auth on the shared Supabase project requires a captcha.
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
  const params = useSearchParams();
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

  const banner =
    params.get("error") === "not-authorized"
      ? "That account is not authorized for the admin panel."
      : params.get("error") === "auth"
        ? "Sign-in link was invalid or expired. Try again."
        : null;

  // Load Cloudflare Turnstile and render the widget once.
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        captchaToken,
      },
    });

    // Turnstile tokens are single-use — reset for any subsequent attempt.
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

  // Verify the 6-digit code from the email. No captcha needed for verification.
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
    // Session cookies are set — full navigation so the proxy/server picks them up.
    window.location.href = "/admin/exercises";
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#07090a] px-4 text-zinc-100">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8">
        <h1 className="text-xl font-semibold">Kamee Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sign in with a magic link or code sent to your email.
        </p>

        {banner && (
          <p className="mt-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {banner}
          </p>
        )}

        <form onSubmit={onSend} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
          <div ref={widgetEl} />
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Send magic link / code"}
          </button>
        </form>

        {status === "sent" && (
          <p className="mt-3 rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            Check your inbox — click the link, or enter the 6-digit code below.
          </p>
        )}

        <form onSubmit={onVerify} className="mt-4 space-y-2">
          <label className="block text-xs text-zinc-500">
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
              className="w-32 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm tracking-widest outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={verifying || code.length < 6}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50"
            >
              {verifying ? "Verifying…" : "Verify code"}
            </button>
          </div>
        </form>

        {message && <p className="mt-3 text-sm text-red-400">{message}</p>}
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
