"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["onboarding", "Getting started", "01"],
  ["profile", "Your profile", "02"],
  ["credentials", "Credentials", "03"],
  ["gallery", "Photo gallery", "04"],
  ["preview", "Profile preview", "05"],
];

export function HubNav({ onboarding }: { onboarding: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="coach-nav" aria-label="Coach workspace">
      {links.filter(([key]) => key !== "onboarding" || onboarding).map(([key, label, number]) => (
        <Link key={key} href={`/coaching/${key}`} aria-current={pathname === `/coaching/${key}` ? "page" : undefined}>
          <span className="coach-nav-number" aria-hidden="true">{number}</span>
          {label}
          <span className="coach-nav-arrow" aria-hidden="true">↗</span>
        </Link>
      ))}
    </nav>
  );
}
