"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["profile", "Your profile", "01"],
  ["credentials", "Credentials", "02"],
  ["gallery", "Photo gallery", "03"],
  ["preview", "Profile preview", "04"],
  ["plans", "Plans", "05"],
  ["videos", "Videos", "06"],
];

export function HubNav() {
  const pathname = usePathname();
  return (
    <nav className="coach-nav" aria-label="Coach workspace">
      {links.map(([key, label, number]) => (
        <Link key={key} href={`/coaching/${key}`} aria-current={pathname === `/coaching/${key}` || pathname.startsWith(`/coaching/${key}/`) ? "page" : undefined}>
          <span className="coach-nav-number" aria-hidden="true">{number}</span>
          {label}
          <span className="coach-nav-arrow" aria-hidden="true">↗</span>
        </Link>
      ))}
    </nav>
  );
}
