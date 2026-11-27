import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CoachProfilePage from "@/app/coaching/(hub)/profile/page";
import type { CoachingProfileRow } from "./queries";

const backend = vi.hoisted(() => ({ coach: vi.fn(), hub: vi.fn(), videos: vi.fn(), browser: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/coaching/auth", () => ({ requireCoach: backend.coach }));
vi.mock("@/lib/coaching/queries", () => ({ loadHub: backend.hub }));
vi.mock("@/lib/coaching/specialty-options-query", () => ({ loadCoachingSpecialtyOptions: async () => ({ options: ["Strength"], error: null }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from: () => ({ select: () => ({ is: () => ({ order: backend.videos }) }) }) }) }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: backend.browser }));
// Keep the page, ProfileForm and optional section real; replace only their
// server/network boundaries. Rendering must retain actual editable form fields.
vi.mock("@/app/coaching/(hub)/actions", () => ({
  saveProfile: vi.fn(), saveDisplayName: vi.fn(), setCoverPath: vi.fn(), setAvatarPath: vi.fn(), acceptCoachTerms: vi.fn(), submitProfile: vi.fn(),
}));
vi.mock("@/app/coaching/(hub)/profile/introduction-actions", () => ({ setIntroductionVideo: vi.fn() }));

const profile: CoachingProfileRow = {
  user_id: "coach-account", headline: "Strength coach", about: "A patient coaching approach.", specialties: ["Strength"],
  years_experience: 3, languages: ["English"], location_label: null, cover_image_path: null, intro_video_id: null,
  socials: {}, is_accepting_clients: true, response_days: 3, terms_accepted_at: null, terms_version: null,
  created_at: "2026-11-28T00:00:00Z", updated_at: "2026-11-28T00:00:00Z",
};

beforeEach(() => {
  backend.coach.mockReset().mockResolvedValue({ user: { id: "coach-account" }, status: "approved" });
  backend.hub.mockReset().mockResolvedValue({ profile, displayName: "Coach", avatarPhotoPath: null, currentTerms: null, missing: [], latestReview: null });
  backend.videos.mockReset().mockResolvedValue({ data: null, error: { message: "Private inventory failure detail" } });
  backend.browser.mockReset().mockImplementation(() => { throw new Error("Private video controls must not mount without inventory"); });
});

describe("profile introduction inventory failures", () => {
  it.each(["database", "network"])("keeps actual profile editing available when the optional %s query fails", async failure => {
    if (failure === "network") backend.videos.mockRejectedValueOnce(new Error("Private inventory failure detail"));
    const page = new JSDOM(renderToStaticMarkup(await CoachProfilePage()));
    try {
      const headline = page.window.document.querySelector<HTMLInputElement>('input[placeholder="e.g. Strength and conditioning coach"]');
      expect(headline?.value).toBe("Strength coach");
      expect(headline?.disabled).toBe(false);
      expect(page.window.document.querySelector("textarea")).not.toBeNull();
      const optional = page.window.document.querySelector('[aria-label="Introduction video"]');
      expect(optional?.querySelector('[role="alert"]')).not.toBeNull();
      expect(optional?.querySelector("button, input, select, video")).toBeNull();
      expect(optional?.textContent).toMatch(/reload/i);
      expect(page.window.document.body.textContent).not.toContain("Private inventory failure detail");
      expect(backend.browser).not.toHaveBeenCalled();
    } finally { page.window.close(); }
  });

  it("propagates a core profile loading failure", async () => {
    const failure = new Error("Core profile unavailable");
    backend.hub.mockRejectedValueOnce(failure);
    await expect(CoachProfilePage()).rejects.toBe(failure);
  });

  it("propagates the authentication gate failure", async () => {
    const failure = new Error("Authentication unavailable");
    backend.coach.mockRejectedValueOnce(failure);
    await expect(CoachProfilePage()).rejects.toBe(failure);
    expect(backend.hub).not.toHaveBeenCalled();
    expect(backend.videos).not.toHaveBeenCalled();
  });

  it.each(["onboarding", "changes_requested", "in_review", "suspended"])("does not query optional videos while %s", async status => {
    backend.coach.mockResolvedValueOnce({ user: { id: "coach-account" }, status });
    const page = new JSDOM(renderToStaticMarkup(await CoachProfilePage()));
    try {
      expect(page.window.document.querySelector('[aria-label="Introduction video"]')).not.toBeNull();
      expect(backend.videos).not.toHaveBeenCalled();
      expect(backend.browser).not.toHaveBeenCalled();
    } finally { page.window.close(); }
  });
});
