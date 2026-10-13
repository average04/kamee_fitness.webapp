export const COACH_WORKSPACE_SECTIONS = [
  {
    id: "profile",
    label: "Profile",
    href: "/coaching/profile",
    pages: [
      { href: "/coaching/profile", label: "Profile details" },
      { href: "/coaching/credentials", label: "Credentials" },
      { href: "/coaching/gallery", label: "Photo gallery" },
      { href: "/coaching/preview", label: "Preview" },
    ],
  },
  {
    id: "plans",
    label: "Plans",
    href: "/coaching/plans",
    pages: [
      { href: "/coaching/plans", label: "My plans" },
      { href: "/coaching/plans/new", label: "Create plan" },
      { href: "/coaching/videos", label: "Video assets" },
    ],
  },
] as const;

function containsPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Match complete path segments, with the most specific page taking priority. */
export function getCoachWorkspaceNavigation(pathname: string) {
  const section = COACH_WORKSPACE_SECTIONS.find((area) =>
    area.pages.some((page) => containsPath(pathname, page.href)),
  ) ?? COACH_WORKSPACE_SECTIONS[0];
  const page = section.pages
    .filter((item) => containsPath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0] ?? section.pages[0];
  const pageLabel = page.href === "/coaching/plans" &&
    pathname.replace(/\/+$/, "") !== page.href ? "Plan editor" : page.label;
  return { section, page, pageLabel };
}
