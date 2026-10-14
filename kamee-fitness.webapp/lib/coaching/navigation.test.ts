import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HubLocation, HubNav, HubSectionNav } from "@/components/coaching/HubNav";

const route = vi.hoisted(() => ({ pathname: "/coaching/profile" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

function renderedLinks(Component: typeof HubNav) {
  const markup = renderToStaticMarkup(createElement(Component));
  return [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    href: match[1].match(/href="([^"]+)"/)?.[1],
    current: match[1].match(/aria-current="([^"]+)"/)?.[1],
    label: match[2].replace(/<[^>]+>/g, "").trim(),
  }));
}

const primaryLinks = () => renderedLinks(HubNav);

describe("coach workspace navigation", () => {
  beforeEach(() => { route.pathname = "/coaching/profile"; });

  it("offers Profile and Plans as the two main areas", () => {
    expect(primaryLinks().map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/coaching/profile", label: "Profile" },
      { href: "/coaching/plans", label: "Plans" },
    ]);
  });

  it.each(["profile", "credentials", "gallery", "preview"])(
    "keeps the Profile area selected on %s", (page) => {
      route.pathname = `/coaching/${page}`;
      expect(primaryLinks().filter((link) => link.current)).toMatchObject([
        { href: "/coaching/profile", current: "location" },
      ]);
    },
  );

  it.each(["/coaching/plans", "/coaching/plans/new", "/coaching/plans/plan-id", "/coaching/videos"])(
    "keeps the Plans area selected on %s", (pathname) => {
      route.pathname = pathname;
      expect(primaryLinks().filter((link) => link.current)).toMatchObject([
        { href: "/coaching/plans", current: "location" },
      ]);
    },
  );

  it("keeps all four profile pages within Profile", () => {
    expect(renderedLinks(HubSectionNav).map((link) => link.label)).toEqual([
      "Profile details", "Credentials", "Photo gallery", "Preview",
    ]);
  });

  it("keeps plan creation and video assets within Plans", () => {
    route.pathname = "/coaching/videos";
    expect(renderedLinks(HubSectionNav).map((link) => link.label)).toEqual([
      "My plans", "Create plan", "Video assets",
    ]);
  });

  it.each([
    ["/coaching/plans", "/coaching/plans"],
    ["/coaching/plans/new", "/coaching/plans/new"],
    ["/coaching/plans/new/", "/coaching/plans/new"],
    ["/coaching/plans/new-year-plan", "/coaching/plans"],
    ["/coaching/plans/plan-id", "/coaching/plans"],
    ["/coaching/videos", "/coaching/videos"],
    ["/coaching/credentials", "/coaching/credentials"],
    ["/coaching/gallery", "/coaching/gallery"],
    ["/coaching/preview", "/coaching/preview"],
  ])("selects exactly one secondary page on %s", (pathname, href) => {
    route.pathname = pathname;
    expect(renderedLinks(HubSectionNav).filter((link) => link.current)).toMatchObject([
      { href, current: "page" },
    ]);
  });

  it("identifies an open plan as an editor rather than plan creation", () => {
    route.pathname = "/coaching/plans/plan-id";
    const markup = renderToStaticMarkup(createElement(HubLocation));
    expect(markup).toContain("Plan editor");
    expect(markup).not.toContain("Create plan");
  });
});
