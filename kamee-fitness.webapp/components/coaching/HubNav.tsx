"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { COACH_WORKSPACE_SECTIONS, getCoachWorkspaceNavigation } from "@/lib/coaching/navigation";

export function HubNav() {
  const pathname = usePathname();
  const { section } = getCoachWorkspaceNavigation(pathname);
  return (
    <nav className="coach-nav" aria-label="Coach workspace">
      {COACH_WORKSPACE_SECTIONS.map((area) => (
        <Link key={area.id} href={area.href} aria-current={section.id === area.id ? "location" : undefined}>
          <svg className="coach-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {area.id === "profile" ? (
              <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>
            ) : (
              <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h4" /></>
            )}
          </svg>
          {area.label}
        </Link>
      ))}
    </nav>
  );
}

export function HubSectionNav() {
  const pathname = usePathname();
  const { section, page } = getCoachWorkspaceNavigation(pathname);
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = navigation.current;
    if (element && element.scrollWidth > element.clientWidth) {
      element.querySelector('[aria-current="page"]')?.scrollIntoView({
        block: "nearest", inline: "nearest",
      });
    }
  }, [pathname]);

  return (
    <nav ref={navigation} className="coach-section-nav" aria-label={`${section.label} pages`}>
      {section.pages.map((item) => (
        <Link key={item.href} href={item.href} aria-current={page.href === item.href ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function HubLocation() {
  const { section, pageLabel } = getCoachWorkspaceNavigation(usePathname());
  return (
    <div className="coach-location">
      <span className="coach-location-section">{section.label}</span>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
      <span className="coach-location-page">{pageLabel}</span>
    </div>
  );
}
