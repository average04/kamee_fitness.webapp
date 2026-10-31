import { createElement, type AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/coaching/profile", pendingHref: null as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/link", async () => {
  const React = await import("react");
  const LinkPending = React.createContext(false);
  return {
    default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) =>
      React.createElement("a", { href, ...props },
        React.createElement(LinkPending.Provider, { value: navigation.pendingHref === href }, children)),
    useLinkStatus: () => ({ pending: React.useContext(LinkPending) }),
  };
});
import { HubNav, HubSectionNav } from "@/components/coaching/HubNav";

const render = (secondary = false) => renderToStaticMarkup(createElement(secondary ? HubSectionNav : HubNav));
const links = (markup: string) => [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
  href: m[1].match(/href="([^"]+)"/)?.[1], content: m[2],
}));

describe("coach navigation loading feedback", () => {
  beforeEach(() => { navigation.pathname = "/coaching/profile"; navigation.pendingHref = null; });

  it("does not show a loader while navigation is idle", () => {
    expect(render()).not.toContain('role="status"');
    expect(render(true)).not.toContain('role="status"');
  });

  it("shows accessible feedback inside the pending primary destination only", () => {
    navigation.pendingHref = "/coaching/clients";
    const markup = render();
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(links(markup).find((link) => link.href === navigation.pendingHref)?.content).toContain('class="coach-loading-announcement">Loading…');
    expect(links(markup).find((link) => link.href === "/coaching/earnings")?.content).not.toContain("Loading…");
  });

  it("also covers the Profile and Plans secondary navigation", () => {
    navigation.pendingHref = "/coaching/gallery";
    expect(render(true)).toContain("Loading…");
    navigation.pathname = "/coaching/plans";
    navigation.pendingHref = "/coaching/videos";
    expect(render(true)).toContain("Loading…");
  });

  it("follows the latest destination and clears feedback when Next finishes or cancels", () => {
    navigation.pendingHref = "/coaching/clients";
    expect(render()).toContain("Loading…");
    navigation.pendingHref = "/coaching/earnings";
    const markup = render();
    expect(links(markup).find((link) => link.href === "/coaching/clients")?.content).not.toContain("Loading…");
    expect(links(markup).find((link) => link.href === "/coaching/earnings")?.content).toContain("Loading…");
    navigation.pendingHref = null;
    expect(render()).not.toContain('role="status"');
  });
});
