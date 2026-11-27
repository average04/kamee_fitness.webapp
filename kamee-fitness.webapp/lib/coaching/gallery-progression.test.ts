import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GalleryPage from "@/app/coaching/(hub)/gallery/page";
import { Checklist } from "@/components/coaching/Checklist";
import { SubmitBlock } from "@/components/coaching/SubmitBlock";
import type { GalleryRow } from "./gallery";

const backend = vi.hoisted(() => ({ coach: vi.fn(), gallery: vi.fn() }));
vi.mock("@/lib/coaching/auth", () => ({ requireCoach: backend.coach }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: backend.gallery }) }) }) }),
  }),
}));
// Keep the page, gallery controls, checklist and submission UI real; only
// authentication, database reads and server mutations cross external boundaries.
vi.mock("@/app/coaching/(hub)/actions", () => ({
  addGalleryPhoto: vi.fn(), deleteGalleryPhoto: vi.fn(), reorderGallery: vi.fn(),
  updateGalleryCaption: vi.fn(), submitProfile: vi.fn(),
}));

beforeEach(() => {
  backend.coach.mockReset().mockResolvedValue({ user: { id: "coach-account" }, status: "onboarding" });
  backend.gallery.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("gallery progression", () => {
  it.each([0, 1, 2])("offers profile preview with %i gallery photos", async (count) => {
    const photos: GalleryRow[] = Array.from({ length: count }, (_, index) => ({
      id: `photo-${index}`, image_path: `coaching/coach-account/gallery/${index}.jpg`,
      caption: null, position: index,
    }));
    backend.gallery.mockResolvedValueOnce({ data: photos, error: null });
    const page = new JSDOM(renderToStaticMarkup(await GalleryPage()));
    try {
      const next = page.window.document.querySelector<HTMLAnchorElement>('a[href="/coaching/preview"]');
      expect(next).not.toBeNull();
      expect(next?.textContent).toMatch(/next: profile preview/i);
      expect(next?.hasAttribute("aria-disabled")).toBe(false);
      expect(page.window.document.querySelector("header")?.textContent).toMatch(/optional/i);
      expect(page.window.document.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(false);
      expect(page.window.document.querySelectorAll('input[maxlength="120"]')).toHaveLength(count);
    } finally { page.window.close(); }
  });

  it("keeps gallery editing locked while a profile is in review", async () => {
    backend.coach.mockResolvedValueOnce({ user: { id: "coach-account" }, status: "in_review" });
    const page = new JSDOM(renderToStaticMarkup(await GalleryPage()));
    try {
      expect(page.window.document.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(true);
      expect(page.window.document.querySelector('a[href="/coaching/preview"]')).not.toBeNull();
    } finally { page.window.close(); }
  });

  it.each(["database", "network"])("keeps preview available when the optional %s read fails", async (failure) => {
    if (failure === "network") backend.gallery.mockRejectedValueOnce(new Error("Private gallery failure detail"));
    else backend.gallery.mockResolvedValueOnce({ data: null, error: { message: "Private gallery failure detail" } });
    const page = new JSDOM(renderToStaticMarkup(await GalleryPage()));
    try {
      expect(page.window.document.querySelector('a[href="/coaching/preview"]')).not.toBeNull();
      expect(page.window.document.querySelector('[role="alert"]')?.textContent).toMatch(/reload/i);
      expect(page.window.document.querySelector('input, button, label')).toBeNull();
      expect(page.window.document.body.textContent).not.toContain("Private gallery failure detail");
    } finally { page.window.close(); }
  });

  it("propagates the authentication gate failure", async () => {
    const failure = new Error("Authentication unavailable");
    backend.coach.mockRejectedValueOnce(failure);
    await expect(GalleryPage()).rejects.toBe(failure);
    expect(backend.gallery).not.toHaveBeenCalled();
  });
});

describe("profile completion without a gallery", () => {
  it.each([
    [[], "3", "3"],
    [["gallery"], "3", "3"],
    [["headline"], "2", "3"],
    [["about", "terms"], "1", "3"],
    [["profile"], "0", "3"],
  ])("reports required progress for missing %j", (missing, done, total) => {
    const page = new JSDOM(renderToStaticMarkup(createElement(Checklist, { missing: missing as string[] })));
    try {
      const progress = page.window.document.querySelector('[role="progressbar"]');
      expect(progress?.getAttribute("aria-valuenow")).toBe(done);
      expect(progress?.getAttribute("aria-valuemax")).toBe(total);
      expect(page.window.document.querySelectorAll("li")).toHaveLength(3);
    } finally { page.window.close(); }
  });

  it.each(["headline", "profile", "future_requirement", "gallery"])(
    "keeps the server-reported %s blocker authoritative", (key) => {
      const page = new JSDOM(renderToStaticMarkup(createElement(SubmitBlock, { missing: [key], status: "onboarding" })));
      try {
        expect(page.window.document.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
      } finally { page.window.close(); }
    },
  );

  it("enables submission when the server reports no missing requirements", () => {
    const page = new JSDOM(renderToStaticMarkup(createElement(SubmitBlock, { missing: [], status: "onboarding" })));
    try {
      expect(page.window.document.querySelector<HTMLButtonElement>("button")?.disabled).toBe(false);
    } finally { page.window.close(); }
  });
});
