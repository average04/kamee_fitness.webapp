import Link from "next/link";

/** Return to the unified profile and setup page. */
export function BackLink() {
  return (
    <Link
      href="/coaching/profile"
      className="inline-flex items-center gap-1 text-sm text-muted hover:text-mist"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back to profile
    </Link>
  );
}
