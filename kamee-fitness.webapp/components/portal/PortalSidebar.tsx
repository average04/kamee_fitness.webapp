"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState, type ReactNode } from "react";
import { CoachLink } from "@/components/coaching/CoachLink";
import { getActivePortalHref, getPortalNavigation, getPortalRoleLabel, type PortalNavigationAccess, type PortalNavigationItem } from "@/lib/portal/navigation";
import styles from "./portal.module.css";

export type PortalSidebarProps = {
  access: PortalNavigationAccess;
  email: string | null;
  signOut: ReactNode;
  surface: "member" | "coach" | "admin";
};

export function PortalSidebar(props: PortalSidebarProps) {
  const pathname = usePathname();
  // A successful route change closes the mobile disclosure. A cancelled
  // unsaved-work navigation keeps this instance and its open state intact.
  return <SidebarDisclosure key={pathname} {...props} pathname={pathname} />;
}

function SidebarDisclosure({ access, email, signOut, surface, pathname }: PortalSidebarProps & { pathname: string }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const id = useId();
  const sections = getPortalNavigation(access);
  const activeHref = getActivePortalHref(sections, pathname);
  // Coaching routes load the existing feedback styles and leave navigation
  // clicks available to the workspace's unsaved-work capture handlers.
  const NavigationLink = surface === "coach" ? CoachLink : Link;

  return (
    <aside className={styles.sidebar} aria-label="Account workspace" onKeyDown={event => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        menu.current?.focus();
      }
    }}>
      <div className={styles.sidebarHeader}>
        <NavigationLink href={access.defaultDestination} className={styles.brand} aria-label="Kamee home">
          <Image src="/adaptive-icon.png" width={40} height={40} alt="" className={styles.brandMark} />
          <span className={styles.brandName}>Kamee<span className={styles.role} data-portal-role>{getPortalRoleLabel(access)}</span></span>
        </NavigationLink>
        <button ref={menu} type="button" className={styles.menu} aria-expanded={open} aria-controls={`${id}-navigation`} onClick={() => setOpen(value => !value)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d={open ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>
          Menu
        </button>
      </div>
      <div id={`${id}-navigation`} className={styles.disclosure} data-open={open}>
        <nav className={styles.navigation} aria-label="Portal navigation">
          {sections.map(section => (
            <section key={section.id} className={styles.group} aria-labelledby={`${id}-${section.id}`}>
              <h2 id={`${id}-${section.id}`} className={styles.groupLabel}>{section.label}</h2>
              <ul className={styles.links}>
                {section.items.map(item => (
                  <li key={item.href}>
                    <NavigationLink href={item.href} className={styles.navLink} aria-current={activeHref === item.href ? "page" : undefined}>
                      <NavigationIcon icon={item.icon} />
                      <span>{item.label}</span>
                    </NavigationLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <div className={styles.account}>
          {email && <p className={styles.email}>{email}</p>}
          <div className={styles.signOut}>{signOut}</div>
        </div>
      </div>
    </aside>
  );
}

function NavigationIcon({ icon }: { icon: PortalNavigationItem["icon"] }) {
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {icon === "dashboard" ? <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>
      : icon === "people" ? <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5.65" /></>
      : icon === "profile" ? <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>
      : icon === "earnings" ? <><path d="M4 3v17h17M8 15l4-5 4 2 5-7" /></>
      : icon === "exercises" ? <><path d="m8 8 8 8M5 5l3-3m-6 6 3-3m11 14 3-3m-3 6 6-6M2 8l6-6M16 22l6-6M5 11l6-6M13 19l6-6" /></>
      : icon === "commerce" ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>
      : icon === "records" ? <><path d="M8 3h8v5a4 4 0 0 1-8 0V3Zm4 9v6m-4 3h8M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4" /></>
      : <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h4" /></>}
  </svg>;
}
