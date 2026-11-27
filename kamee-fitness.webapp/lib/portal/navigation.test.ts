import { describe, expect, it } from "vitest";
import { getPortalNavigation, getPortalRoleLabel, getActivePortalHref, type PortalNavigationAccess } from "./navigation";

const member: PortalNavigationAccess = { isAdmin: false, canUseCoachHub: false, coachStatus: "none", defaultDestination: "/me" };
const links = (access: PortalNavigationAccess) => getPortalNavigation(access).flatMap(section => section.items.map(item => item.href));

describe("portal navigation from verified capabilities", () => {
  it("gives members their dashboard and records without coach or admin destinations", () => {
    expect(links(member)).toEqual(["/me", "/me/records"]);
    expect(getPortalRoleLabel(member)).toBe("Member");
  });
  it("gives approved coaches their workspace and personal activity", () => {
    const coach = { ...member, canUseCoachHub: true, coachStatus: "approved" as const, defaultDestination: "/coaching/dashboard" };
    expect(links(coach)).toEqual(expect.arrayContaining(["/me", "/coaching/dashboard", "/coaching/clients", "/coaching/plans", "/coaching/earnings", "/coaching/profile"]));
    expect(links(coach).some(href => href.startsWith("/admin"))).toBe(false);
    expect(getPortalRoleLabel(coach)).toBe("Coach");
  });
  it.each(["onboarding", "in_review", "changes_requested", "suspended"] as const)("keeps %s coaches on their profile and setup pages", coachStatus => {
    const coach = { ...member, canUseCoachHub: true, coachStatus, defaultDestination: "/coaching/profile" };
    expect(links(coach)).toEqual(["/coaching/profile", "/me", "/me/records"]);
  });
  it("shows an invitation without offering private coach tools", () => {
    const invited = { ...member, coachStatus: "invited" as const, defaultDestination: "/coaching/invite" };
    expect(links(invited)).toEqual(["/coaching/invite", "/me", "/me/records"]);
  });
  it("gives admins administrative sections without inventing coaching permission", () => {
    const admin = { ...member, isAdmin: true, defaultDestination: "/admin" };
    expect(links(admin)).toEqual(expect.arrayContaining(["/admin", "/admin/plans", "/admin/exercises", "/admin/coaches", "/admin/coaching-plans", "/admin/coaching-commerce", "/me"]));
    expect(links(admin).some(href => href.startsWith("/coaching/"))).toBe(false);
    expect(getPortalRoleLabel(admin)).toBe("Admin");
  });
  it("matches the most specific complete route segment and keeps coach subsections together", () => {
    expect(getActivePortalHref(getPortalNavigation(member), "/me/records")).toBe("/me/records");
    expect(getActivePortalHref(getPortalNavigation({ ...member, isAdmin: true }), "/admin/coaches/coach-id")).toBe("/admin/coaches");
    expect(getActivePortalHref(getPortalNavigation({ ...member, isAdmin: true }), "/administrator")).toBeNull();
    const coach = getPortalNavigation({ ...member, canUseCoachHub: true, coachStatus: "approved" });
    expect(getActivePortalHref(coach, "/coaching/videos")).toBe("/coaching/plans");
    expect(getActivePortalHref(coach, "/coaching/credentials")).toBe("/coaching/profile");
    expect(getActivePortalHref(coach, "/coaching/clients/attempt-id")).toBe("/coaching/clients");
  });
});
