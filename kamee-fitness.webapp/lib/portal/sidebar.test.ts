import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortalSidebar, type PortalSidebarProps } from "@/components/portal/PortalSidebar";

const route = vi.hoisted(() => ({ pathname: "/me" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

let root: Root | undefined;
let dom: JSDOM | undefined;
const member: PortalSidebarProps = {
  access: { isAdmin: false, canUseCoachHub: false, coachStatus: "none", defaultDestination: "/me" },
  email: "member@example.com",
  surface: "member",
  signOut: createElement("button", { type: "submit" }, "Sign out"),
};

beforeEach(() => { route.pathname = "/me"; });
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  dom?.window.close();
  dom = undefined;
  vi.unstubAllGlobals();
});

async function mount(props = member) {
  dom = new JSDOM('<div id="root"></div>', { url: "https://kamee.fit/me" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("self", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  root = (await import("react-dom/client")).createRoot(document.getElementById("root")!);
  const render = () => act(async () => root!.render(createElement(PortalSidebar, props)));
  await render();
  return { render };
}

function menu() {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.includes("Menu"));
  expect(button, "labelled navigation disclosure").toBeDefined();
  return button!;
}

function disclosure() {
  const panel = document.getElementById(menu().getAttribute("aria-controls") ?? "");
  expect(panel, "menu controls an existing panel").not.toBeNull();
  return panel!;
}

describe("portal sidebar disclosure", () => {
  it("starts collapsed with persistent brand and role, then exposes account navigation", async () => {
    await mount();
    expect(menu().getAttribute("aria-expanded")).toBe("false");
    expect(disclosure().getAttribute("data-open")).toBe("false");
    expect(document.querySelector('a[aria-label="Kamee home"]')?.textContent).toContain("Kamee");
    expect(document.querySelector('[data-portal-role]')?.textContent).toBe("Member");
    await act(async () => menu().click());
    expect(menu().getAttribute("aria-expanded")).toBe("true");
    expect(disclosure().getAttribute("data-open")).toBe("true");
    expect(disclosure().querySelector('nav[aria-label="Portal navigation"]')).not.toBeNull();
    expect(disclosure().textContent).toContain("member@example.com");
    expect(disclosure().textContent).toContain("Sign out");
  });

  it("closes on Escape from a navigation link and returns focus to Menu", async () => {
    await mount();
    await act(async () => menu().click());
    const link = disclosure().querySelector<HTMLAnchorElement>('a[href="/me/records"]')!;
    link.focus();
    await act(async () => link.dispatchEvent(new dom!.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(menu().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menu());
  });

  it("collapses after a pathname change and selects only the most specific member destination", async () => {
    const { render } = await mount();
    await act(async () => menu().click());
    route.pathname = "/me/records";
    await render();
    expect(menu().getAttribute("aria-expanded")).toBe("false");
    const current = document.querySelectorAll('nav a[aria-current]');
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute("href")).toBe("/me/records");
  });

  it("renders coach subsections as one active workspace entry without admin tools", async () => {
    route.pathname = "/coaching/videos";
    await mount({ ...member, surface: "coach", access: { isAdmin: false, canUseCoachHub: true, coachStatus: "approved", defaultDestination: "/coaching/dashboard" } });
    expect(document.querySelector('[data-portal-role]')?.textContent).toBe("Coach");
    expect(document.querySelector('nav a[aria-current]')?.getAttribute("href")).toBe("/coaching/plans");
    expect(document.querySelector('a[href="/coaching/clients"]')).not.toBeNull();
    expect(document.querySelector('a[href="/admin"]')).toBeNull();
  });
});
