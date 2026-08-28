import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-8 text-xs text-muted sm:px-6 sm:flex-row sm:justify-between lg:px-8">
        <div className="flex items-center gap-2.5">
          <Image
            src="/adaptive-icon.png"
            alt=""
            width={24}
            height={24}
            className="size-6"
          />
          <span>© 2026 Kamee Fitness. All rights reserved.</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
          <Link href="/blog" className="hover:text-mist">
            Blog
          </Link>
          <a href="/me" className="hover:text-mist">
            Log in
          </a>
          <Link href="/terms" className="hover:text-mist">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-mist">
            Privacy
          </Link>
          <Link href="/delete-account" className="hover:text-mist">
            Delete account
          </Link>
          <a href="https://developer.kamee.fit" className="hover:text-mist">
            Developers
          </a>
          <a href="mailto:support@kamee.fit" className="hover:text-mist">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
