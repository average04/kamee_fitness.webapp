"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setMessage("Network error. Please check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        className="reveal flex items-center gap-3 rounded-2xl border border-leaf-500/25 bg-leaf-500/10 px-5 py-4 text-left"
        role="status"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf-500/20 text-leaf-400">
          <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <p className="font-display text-base font-semibold text-mist">
            You&rsquo;re on the list.
          </p>
          <p className="text-sm text-muted">
            We&rsquo;ll email you the moment Kamee Fitness goes live.
          </p>
        </div>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      {/* Honeypot — hidden from real users, catches bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:rounded-full sm:border sm:border-white/10 sm:bg-ink-800/60 sm:p-1.5 sm:pl-5 sm:backdrop-blur-sm sm:transition-[border-color,box-shadow] sm:focus-within:border-leaf-500/50 sm:focus-within:shadow-[0_0_0_4px_rgba(125,190,141,0.10)]">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          disabled={submitting}
          className="h-13 flex-1 rounded-full border border-white/10 bg-ink-800/60 px-5 text-base text-mist outline-none transition placeholder:text-muted/70 focus:border-leaf-500/50 focus:shadow-[0_0_0_4px_rgba(125,190,141,0.10)] disabled:opacity-60 sm:h-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-2.5 sm:shadow-none sm:focus:shadow-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="group inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-full bg-leaf-500 px-6 font-display text-base font-semibold text-ink-950 transition hover:bg-leaf-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:h-11"
        >
          {submitting ? (
            <>
              <svg
                viewBox="0 0 24 24"
                className="size-4 animate-spin"
                aria-hidden
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Joining…
            </>
          ) : (
            <>
              Join the waitlist
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                <path
                  d="M5 12h14m-6-6 6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </button>
      </div>

      {status === "error" && (
        <p className="mt-2.5 pl-1 text-sm text-ember-400" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
