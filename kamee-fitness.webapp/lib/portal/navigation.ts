import { isHubState, type CoachStatus } from "@/lib/coaching/states";
import { COACH_WORKSPACE_SECTIONS } from "@/lib/coaching/navigation";

export type PortalNavigationAccess = {
  isAdmin: boolean;
  canUseCoachHub: boolean;
  coachStatus: CoachStatus;
  defaultDestination: string;
};
export type PortalNavigationItem = { href: string; label: string; paths: readonly string[]; icon: "dashboard" | "records" | "people" | "plans" | "exercises" | "commerce" | "profile" | "earnings" };
export type PortalNavigationSection = { id: string; label: string; items: PortalNavigationItem[] };

export function getPortalNavigation(access: PortalNavigationAccess): PortalNavigationSection[] {
  const sections: PortalNavigationSection[] = [];
  if (access.isAdmin) {
    sections.push({
      id: "admin", label: "Administration", items: [
        { href: "/admin", label: "Dashboard", paths: ["/admin"], icon: "dashboard" },
        { href: "/admin/plans", label: "Plans", paths: ["/admin/plans"], icon: "plans" },
        { href: "/admin/exercises", label: "Exercises", paths: ["/admin/exercises"], icon: "exercises" },
        { href: "/admin/coaches", label: "Coaches", paths: ["/admin/coaches"], icon: "people" },
        { href: "/admin/coaching-plans", label: "Coaching plans", paths: ["/admin/coaching-plans"], icon: "plans" },
        { href: "/admin/coaching-commerce", label: "Product readiness", paths: ["/admin/coaching-commerce"], icon: "commerce" },
      ],
    });
  }
  if (access.canUseCoachHub && isHubState(access.coachStatus)) {
    const areas = access.coachStatus === "approved"
      ? COACH_WORKSPACE_SECTIONS
      : COACH_WORKSPACE_SECTIONS.filter(area => area.id === "profile");
    sections.push({
      id: "coach", label: "Coach workspace", items: areas.map(area => ({
        href: area.href,
        label: area.label,
        paths: area.pages.map(page => page.href),
        icon: area.id === "clients" ? "people" : area.id,
      })),
    });
  } else if (access.coachStatus === "invited") {
    sections.push({
      id: "invitation", label: "Coaching", items: [
        { href: "/coaching/invite", label: "Coach invitation", paths: ["/coaching/invite"], icon: "profile" },
      ],
    });
  }
  sections.push({
    id: "member", label: "Your activity", items: [
      { href: "/me", label: "Dashboard", paths: ["/me"], icon: "dashboard" },
      { href: "/me/records", label: "Records", paths: ["/me/records"], icon: "records" },
    ],
  });
  return sections;
}
export function getPortalRoleLabel(access: PortalNavigationAccess): string {
  if (access.isAdmin) return "Admin";
  return access.canUseCoachHub || access.coachStatus === "invited" ? "Coach" : "Member";
}
export function getActivePortalHref(sections: PortalNavigationSection[], pathname: string): string | null {
  let active: string | null = null;
  let matchLength = -1;
  for (const section of sections) {
    for (const item of section.items) {
      for (const path of item.paths) {
        if ((pathname === path || pathname.startsWith(`${path}/`)) && path.length > matchLength) {
          active = item.href;
          matchLength = path.length;
        }
      }
    }
  }
  return active;
}
