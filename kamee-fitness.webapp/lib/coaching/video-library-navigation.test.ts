import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoLibrary } from "@/components/coaching/plans/VideoLibrary";
import type { Video } from "./plans";

const video: Video = {
  id: "00000000-0000-4000-8000-000000000001", title: "Squat demonstration", caption: "",
  status: "uploading", failure_reason: null, duration_seconds: null, retired_at: null, provider_ref: "source.mp4",
};

// Replace the external storage transport and signed-in backend only. The real
// component starts/pauses the upload and installs its own document event guard.
vi.mock("tus-js-client", () => ({
  Upload: class {
    async findPreviousUploads() { return []; }
    resumeFromPreviousUpload() {}
    start() {}
    async abort() {}
  },
}));
vi.mock("@/app/coaching/(hub)/profile/introduction-actions", () => ({ setIntroductionVideo: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: "coach-account" }, access_token: "test-token" } }, error: null }) },
    from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
  }),
}));

let root: Root | undefined;
let dom: JSDOM | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  dom?.window.close();
  dom = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function button(label: string) {
  const result = [...document.querySelectorAll<HTMLButtonElement>("button")].find(element => element.textContent === label);
  expect(result, label).toBeDefined();
  return result!;
}

async function mount(paused: boolean) {
  dom = new JSDOM('<div id="root"></div><a id="navigation"><span>Skip to content</span></a><main id="coach-content"></main>', {
    url: "https://kamee.fit/coaching/videos?view=library#upload",
  });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("location", dom.window.location);
  vi.stubGlobal("Element", dom.window.Element);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  const confirm = vi.fn(() => false);
  vi.stubGlobal("confirm", confirm);
  const navigation = new dom.window.EventTarget();
  Object.defineProperty(dom.window, "navigation", { value: navigation });
  root = (await import("react-dom/client")).createRoot(document.getElementById("root")!);
  await act(async () => root!.render(createElement(VideoLibrary, { initial: [video], initialIntroId: null })));
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new dom.window.File(["video"], "squat.mp4", { type: "video/mp4" })] });
  await act(async () => input.dispatchEvent(new dom!.window.Event("change", { bubbles: true })));
  await act(async () => button("Resume with selected file").click());
  expect(button("Pause upload")).toBeDefined();
  if (paused) await act(async () => button("Pause upload").click());

  const link = document.getElementById("navigation") as HTMLAnchorElement;
  // Observe cancellation before JSDOM attempts to perform its default navigation.
  const click = async (href: string, target = "") => {
    link.setAttribute("href", href);
    link.target = target;
    let cancelled: boolean | undefined;
    link.addEventListener("click", event => { cancelled = event.defaultPrevented; event.preventDefault(); }, { once: true });
    const event = new dom!.window.MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => link.querySelector("span")!.dispatchEvent(event));
    return cancelled ?? event.defaultPrevented;
  };
  return { confirm, click, navigation };
}

describe.each([false, true])("video navigation while upload paused=%s", paused => {
  it("allows same-document fragment navigation without asking to leave the upload", async () => {
    const f = await mount(paused);
    for (const href of ["#coach-content", "/coaching/videos?view=library#coach-content", "https://kamee.fit/coaching/videos?view=library#coach-content"]) {
      expect(await f.click(href), href).toBe(false);
    }
    expect(f.confirm).not.toHaveBeenCalled();
    expect(button(paused ? "Resume upload" : "Pause upload")).toBeDefined();
  });

  it("keeps route, query and cross-origin departures cancellable", async () => {
    const f = await mount(paused);
    for (const href of ["/coaching/plans#coach-content", "/coaching/videos?view=other#coach-content", "https://other.example/coaching/videos?view=library#coach-content"]) {
      expect(await f.click(href), href).toBe(true);
    }
    expect(f.confirm).toHaveBeenCalledTimes(3);
    expect(button(paused ? "Resume upload" : "Pause upload")).toBeDefined();
  });
});

it("keeps new-tab links outside the upload departure guard", async () => {
  const f = await mount(false);
  expect(await f.click("/coaching/plans", "_blank")).toBe(false);
  expect(f.confirm).not.toHaveBeenCalled();
});

it("retains beforeunload and cancellable history traversal safeguards", async () => {
  const f = await mount(true);
  const unload = new dom!.window.Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  const traversal = new dom!.window.Event("navigate", { cancelable: true });
  Object.defineProperty(traversal, "navigationType", { value: "traverse" });
  f.navigation.dispatchEvent(traversal);
  expect(traversal.defaultPrevented).toBe(true);
  expect(f.confirm).toHaveBeenCalledTimes(1);
});
