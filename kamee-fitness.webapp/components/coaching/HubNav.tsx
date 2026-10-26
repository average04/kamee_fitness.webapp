"use client";

import { CoachLink as Link } from "@/components/coaching/CoachLink";
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
            ) : area.id === "dashboard" ? (
              <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>
            ) : area.id === "clients" ? (
              <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5.65" /></>
            ) : area.id === "earnings" ? (
              <><path d="M4 3v17h17M8 15l4-5 4 2 5-7" /></>
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

  if (section.pages.length === 1) return null;

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
  if (section.pages.length === 1) {
    return <div className="coach-location"><span className="coach-location-page">{pageLabel}</span></div>;
  }
  return (
    <div className="coach-location">
      <span className="coach-location-section">{section.label}</span>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
      <span className="coach-location-page">{pageLabel}</span>
    </div>
  );
}
