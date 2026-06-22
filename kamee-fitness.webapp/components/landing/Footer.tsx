import Image from "next/image";
import { StoreBadges } from "./StoreBadges";

export default function Footer() {
  return (
    <footer className="relative">
      {/* Final CTA band */}
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <Image
          src="/adaptive-icon.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto size-12"
        />
        <p className="mt-6 font-display text-[clamp(1.4rem,3.5vw,2rem)] font-bold text-mist">
          Slow and steady wins the race.
        </p>
        <div className="mt-7 flex justify-center">
          <StoreBadges />
        </div>
      </div>

      {/* Legal */}
      <div className="border-t border-white/8 py-6 text-xs text-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <span>© 2026 Kamee Fitness. All rights reserved.</span>
          <nav className="flex flex-wrap items-center justify-center gap-5">
            <a href="/terms" className="hover:text-white">
              Terms
            </a>
            <a href="/privacy" className="hover:text-white">
              Privacy
            </a>
            <a href="/delete-account" className="hover:text-white">
              Delete account
            </a>
            <a href="mailto:bayogjayr@gmail.com" className="hover:text-white">
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
