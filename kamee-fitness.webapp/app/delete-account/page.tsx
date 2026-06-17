"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitDeletionRequest, type DeletionRequestResult } from "./actions";

// Public Turnstile site key — ships in the client bundle by design.
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

export default function DeleteAccountPage() {
  const [state, formAction, isPending] = useActionState<
    DeletionRequestResult | null,
    FormData
  >(submitDeletionRequest, null);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const widgetEl = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  // Load Cloudflare Turnstile and render the widget once — same approach as
  // app/admin/login/page.tsx.
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

  // Reset the Turnstile widget after a failed submission so the user can retry.
  useEffect(() => {
    if (state && !state.ok && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      setCaptchaToken(null);
    }
  }, [state]);

  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <div className="max-w-2xl mx-auto px-6 py-12 lg:py-16">
        <header className="mb-10">
          <a
            href="/"
            className="text-sm text-ink-400 hover:text-leaf-400 inline-flex items-center gap-1"
          >
            ← Kamee Fitness
          </a>
          <h1 className="text-4xl lg:text-5xl font-bold text-leaf-300 mt-4">
            Delete your Kamee Fitness account
          </h1>
        </header>

        {/* In-app deletion */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-ink-100 mb-3">
            Delete in the app
          </h2>
          <p className="text-ink-300 mb-4">
            The fastest way to delete your account is directly inside the app:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-ink-300">
            <li>
              Open <span className="text-ink-100 font-medium">Kamee Fitness</span>
            </li>
            <li>
              Go to{" "}
              <span className="text-ink-100 font-medium">Profile</span>
            </li>
            <li>
              Tap{" "}
              <span className="text-ink-100 font-medium">Delete account</span>
            </li>
            <li>
              Type <span className="font-mono text-ink-100">DELETE</span> to
              confirm
            </li>
          </ol>
          <p className="mt-4 text-ink-400 text-sm">
            Your account and all data are permanently deleted 30 days after you
            confirm. Sign back in before then to cancel.
          </p>
        </section>

        {/* What gets removed */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-ink-100 mb-3">
            What gets removed
          </h2>
          <ul className="list-disc list-inside space-y-2 text-ink-300">
            <li>Profile and settings</li>
            <li>Workouts and track history</li>
            <li>Buddy connections and invites</li>
          </ul>
        </section>

        {/* Request form */}
        <section>
          <h2 className="text-xl font-semibold text-ink-100 mb-2">
            Can&rsquo;t open the app? Request deletion
          </h2>
          <p className="text-ink-400 text-sm mb-6">
            If you no longer have access to the app, submit your request below.
            We&rsquo;ll delete your account and data within 30 days.
          </p>

          {state?.ok ? (
            <div className="rounded-xl border border-leaf-700 bg-leaf-950/30 px-5 py-4 text-leaf-300 text-sm leading-relaxed">
              Thanks — we&rsquo;ve received your request and will delete your
              account and data within 30 days.
            </div>
          ) : (
            <form action={formAction} className="space-y-4">
              {state && !state.ok && (
                <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
                  {state.error}
                </p>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-ink-300 mb-1"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none focus:border-leaf-600"
                />
              </div>

              <div>
                <label
                  htmlFor="note"
                  className="block text-sm font-medium text-ink-300 mb-1"
                >
                  Note{" "}
                  <span className="text-ink-500 font-normal">(optional)</span>
                </label>
                <textarea
                  id="note"
                  name="note"
                  rows={3}
                  placeholder="Any context that may help us locate your account…"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none focus:border-leaf-600 resize-none"
                />
              </div>

              {/* Turnstile widget — token is also passed via the hidden input */}
              <div ref={widgetEl} />
              <input
                type="hidden"
                name="cf-turnstile-response"
                value={captchaToken ?? ""}
              />

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-leaf-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-leaf-500 transition-colors"
              >
                {isPending ? "Submitting…" : "Request account deletion"}
              </button>
            </form>
          )}
        </section>

        <footer className="mt-16 pt-6 border-t border-ink-700 text-xs text-ink-500">
          Questions? Email{" "}
          <a
            href="mailto:bayogjayr@gmail.com"
            className="text-leaf-400 underline"
          >
            bayogjayr@gmail.com
          </a>
          .
        </footer>
      </div>
    </main>
  );
}
