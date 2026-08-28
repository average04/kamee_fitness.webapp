"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Header() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300 " +
        (solid
          ? "border-b border-white/8 bg-ink-950/80 backdrop-blur-md"
          : "border-b border-transparent")
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        {/* Root-relative hashes so the header works off the landing page too:
            on "/" the browser still treats these as same-document scrolls. */}
        <Link href="/#top" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/adaptive-icon.png"
            alt=""
            width={32}
            height={32}
            className="size-7"
          />
          <span className="font-display text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-mist sm:text-sm sm:tracking-[0.18em]">
            Kamee<span className="hidden sm:inline"> Fitness</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Link
            href="/blog"
            className="hidden whitespace-nowrap text-xs font-medium uppercase tracking-[0.16em] text-muted transition-colors hover:text-mist sm:inline"
          >
            Blog
          </Link>
          <a
            href="/me"
            className="whitespace-nowrap text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted transition-colors hover:text-mist sm:text-xs sm:tracking-[0.16em]"
          >
            Log in
          </a>
          <Link
            href="/#get-the-app"
            className="flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-leaf-500/40 bg-leaf-500/10 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-leaf-300 transition-colors hover:bg-leaf-500/20 sm:min-h-10 sm:px-4 sm:text-xs sm:tracking-[0.16em]"
          >
            Get the app
          </Link>
        </div>
      </div>
    </header>
  );
}
