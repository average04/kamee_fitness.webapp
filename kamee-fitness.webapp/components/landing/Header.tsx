"use client";

import Image from "next/image";
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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2.5">
          <Image
            src="/adaptive-icon.png"
            alt=""
            width={32}
            height={32}
            className="size-7"
          />
          <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-mist">
            Kamee Fitness
          </span>
        </a>
        <div className="flex items-center gap-4">
          <a
            href="/me"
            className="text-xs font-medium uppercase tracking-[0.16em] text-muted transition-colors hover:text-mist"
          >
            Log in
          </a>
          <a
            href="#get-the-app"
            className="rounded-full border border-leaf-500/40 bg-leaf-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-leaf-300 transition-colors hover:bg-leaf-500/20"
          >
            Get the app
          </a>
        </div>
      </div>
    </header>
  );
}
