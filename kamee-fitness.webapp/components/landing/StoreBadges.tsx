"use client";

import { useEffect, useRef } from "react";
import {
  buildStoreUrl,
  trackStoreClick,
  type StorePlatform,
} from "@/lib/landing/attribution";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing/stores";

const GLYPH: Record<StorePlatform, string> = {
  ios: "M17.05 12.04c-.03-2.86 2.34-4.23 2.44-4.3-1.33-1.95-3.4-2.22-4.13-2.25-1.76-.18-3.43 1.04-4.32 1.04-.89 0-2.26-1.02-3.72-.99-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.55 1.42 11.35.95 1.37 2.08 2.91 3.56 2.85 1.43-.06 1.97-.92 3.7-.92 1.72 0 2.21.92 3.72.89 1.54-.03 2.51-1.4 3.45-2.78 1.09-1.59 1.54-3.13 1.56-3.21-.03-.01-2.99-1.15-3.02-4.55zM14.13 4.62c.79-.96 1.32-2.29 1.18-3.62-1.14.05-2.52.76-3.33 1.72-.73.85-1.37 2.2-1.2 3.5 1.27.1 2.57-.65 3.35-1.6z",
  android:
    "M4 3.42v17.16a.6.6 0 0 0 .9.52l14.4-8.58a.6.6 0 0 0 0-1.04L4.9 2.9a.6.6 0 0 0-.9.52z",
};

const LABEL: Record<StorePlatform, { eyebrow: string; name: string }> = {
  ios: { eyebrow: "Download on the", name: "App Store" },
  android: { eyebrow: "Get it on", name: "Google Play" },
};

const BASE: Record<StorePlatform, string> = {
  ios: APP_STORE_URL,
  android: PLAY_STORE_URL,
};

export function StoreBadge({
  platform,
  placement,
  variant = "primary",
}: {
  platform: StorePlatform;
  /** Where on the page this button sits — recorded with the click. */
  placement: string;
  variant?: "primary" | "outline";
}) {
  // Rendered with the plain listing so the link works before hydration and in
  // crawlers, then rewritten in place with the ad campaign once the query
  // string is readable. Writing to the DOM node rather than through state
  // keeps this a one-way sync with no extra render.
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.href = buildStoreUrl(platform, window.location.search);
  }, [platform]);

  const { eyebrow, name } = LABEL[platform];

  return (
    <a
      ref={ref}
      href={BASE[platform]}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackStoreClick(platform, placement)}
      aria-label={`${eyebrow} ${name} — Kamee Fitness`}
      className={
        "flex h-[3.625rem] items-center gap-3 rounded-2xl px-6 transition-colors " +
        (variant === "primary"
          ? "bg-ember-500 text-ink-950 shadow-[0_18px_44px_-12px_rgba(232,145,80,0.45)] hover:bg-ember-400"
          : "border border-white/20 bg-white/[0.02] text-mist hover:border-white/35 hover:bg-white/[0.05]")
      }
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5.5 shrink-0" aria-hidden>
        <path d={GLYPH[platform]} />
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] opacity-80">
          {eyebrow}
        </span>
        <span className="font-display text-[1.0625rem] font-bold">{name}</span>
      </span>
    </a>
  );
}

export function StoreBadges({
  placement,
  className,
}: {
  placement: string;
  className?: string;
}) {
  return (
    <div className={"flex flex-wrap items-center gap-4 " + (className ?? "")}>
      <StoreBadge platform="android" placement={placement} />
      <StoreBadge platform="ios" placement={placement} variant="outline" />
    </div>
  );
}
