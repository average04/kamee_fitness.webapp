import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoLibrary } from "@/components/coaching/plans/VideoLibrary";
import type { Video } from "./plans";
import { broadcastAuthBoundary } from "@/lib/auth-boundary";
import { IntroductionVideoSection } from "@/components/coaching/IntroductionVideoSection";

const first: Video = {
  id: "00000000-0000-4000-8000-000000000001", title: "Meet your coach", caption: "Hello",
  status: "ready", failure_reason: null, duration_seconds: 30, retired_at: null, provider_ref: "sealed/first.mp4",
};
const second: Video = { ...first, id: "00000000-0000-4000-8000-000000000002", title: "My coaching approach", provider_ref: "sealed/second.mp4" };
const uploaded: Video = { ...first, id: "00000000-0000-4000-8000-000000000003", title: "New introduction", status: "uploading" };

// Only replace network/storage boundaries. Render the real shared uploader and
// signed player so state, event guards and playback resets remain under test.
const backend = vi.hoisted(() => ({
  rpc: vi.fn(), introAction: vi.fn(), finalize: vi.fn(), rows: [] as Video[], introId: null as string | null,
  uploadOptions: null as { onSuccess(): void; onError(): void } | null,
  authChanged: null as ((event: string, session: { user: { id: string } } | null) => void) | null,
}));
vi.mock("@/app/coaching/(hub)/profile/introduction-actions", () => ({ setIntroductionVideo: backend.introAction }));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "coach-account" }, access_token: "test-token" } }, error: null }),
      onAuthStateChange: (listener: NonNullable<typeof backend.authChanged>) => {
        backend.authChanged = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [...backend.rows], error: null }) }) }) }),
    rpc: backend.rpc,
    functions: { invoke: backend.finalize },
  }),
}));
vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(_file: File, options: { onSuccess(): void; onError(): void }) { backend.uploadOptions = options; }
    async findPreviousUploads() { return []; }
    resumeFromPreviousUpload() {}
    start() {}
    async abort() {}
  },
}));

let root: Root | undefined;
let dom: JSDOM | undefined;

beforeEach(() => {
  backend.rows = [first, second];
  backend.introId = null;
  backend.uploadOptions = null;
  backend.authChanged = null;
  backend.introAction.mockReset().mockImplementation(async (_owner, id) => {
    backend.introId = id;
    return { ok: true };
  });
  backend.rpc.mockReset().mockImplementation(async (name, args) => {
    if (name === "set_coaching_intro_video") {
      backend.introId = args.p_video_id;
      return { data: null, error: null };
    }
    if (name === "begin_coaching_video") {
      backend.rows = [uploaded, ...backend.rows];
      return { data: uploaded, error: null };
    }
    if (name === "retire_coaching_video") {
      backend.rows = backend.rows.filter(video => video.id !== args.p_video_id);
      return { data: null, error: null };
    }
    throw new Error(`Unexpected RPC: ${name}`);
  });
  backend.finalize.mockReset().mockImplementation(async () => {
    backend.rows = backend.rows.map(video => video.id === uploaded.id ? { ...video, status: "ready" } : video);
    return { data: { ready: true }, error: null };
  });
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  dom?.window.close();
  dom = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function button(label: string, scope: ParentNode = document) {
  const element = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === label);
  expect(element, label).toBeDefined();
  return element!;
}

async function mount(introId: string | null = null, rows = backend.rows) {
  backend.introId = introId;
  dom = new JSDOM('<div id="root"></div>', { url: "https://kamee.fit/coaching/profile" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("location", dom.window.location);
  vi.stubGlobal("Element", dom.window.Element);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("confirm", vi.fn(() => false));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    const { id } = JSON.parse(options.body as string);
    requests.push(id);
    return Response.json({ url: `https://storage.example/${id}.mp4?token=signed` });
  });
  root = (await import("react-dom/client")).createRoot(document.getElementById("root")!);
  await act(async () => root!.render(createElement(VideoLibrary, { initial: rows, initialIntroId: introId, mode: "introduction", ownerId: "coach-account" })));
  return { requests };
}

async function openChoices(current = false) {
  await act(async () => button(current ? "Change introduction video" : "Add introduction video").click());
}

async function choose(id: string) {
  const select = document.querySelector<HTMLSelectElement>('select[aria-label="Choose an introduction video"]');
  expect(select).not.toBeNull();
  await act(async () => {
    select!.value = id;
    select!.dispatchEvent(new dom!.window.Event("change", { bubbles: true }));
  });
}

function current() {
  const element = document.querySelector('[aria-label="Current introduction video"]');
  expect(element).not.toBeNull();
  return element!;
}

describe("optional introduction video", () => {
  it.each(["approved", "onboarding", "changes_requested", "in_review", "suspended"] as const)("shows optional management only for an approved coach, lifecycle=%s", status => {
    const page = new JSDOM(renderToStaticMarkup(createElement(IntroductionVideoSection, { status, videos: [first], introId: first.id, ownerId: "coach-account" })));
    try {
      expect(page.window.document.querySelector('[aria-label="Introduction video"]')).not.toBeNull();
      expect(page.window.document.querySelectorAll("button").length > 0).toBe(status === "approved");
      expect(page.window.document.querySelector('[aria-required="true"]')).toBeNull();
    } finally { page.window.close(); }
  });

  it("starts empty without mounting an upload or making introduction required", async () => {
    await mount();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(document.querySelector('[aria-label="Current introduction video"]')).toBeNull();
    expect(button("Add introduction video").disabled).toBe(false);
    expect(document.querySelector('[aria-required="true"]')).toBeNull();
    expect(backend.rpc).not.toHaveBeenCalled();
  });

  it("opens the uploader directly when there are no ready videos to choose", async () => {
    await mount(null, []);
    await openChoices();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
    expect(document.querySelector("select")).toBeNull();
    expect(document.querySelector("details")).toBeNull();
  });

  it("previews an owned ready choice and attaches only after explicit confirmation", async () => {
    const { requests } = await mount();
    await openChoices();
    await choose(second.id);
    expect(backend.introId).toBeNull();
    await act(async () => button("Play video").click());
    expect(requests).toEqual([second.id]);
    await act(async () => button("Use as introduction video").click());
    expect(backend.introAction).toHaveBeenCalledWith("coach-account", second.id);
    expect(backend.rpc).not.toHaveBeenCalled();
    expect(backend.introId).toBe(second.id);
    expect(current().textContent).toContain(second.title);
  });

  it("retains the current playback until replacement succeeds and resets its signed player", async () => {
    const { requests } = await mount(first.id);
    await act(async () => button("Play video", current()).click());
    expect(current().querySelector("video")?.src).toContain(first.id);
    await openChoices(true);
    await choose(second.id);
    let finish!: () => void;
    backend.introAction.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { finish = resolve; });
      backend.introId = second.id;
      return { ok: true };
    });
    await act(async () => button("Use as introduction video").click());
    expect(current().querySelector("video")?.src).toContain(first.id);
    await act(async () => finish());
    expect(current().textContent).toContain(second.title);
    expect(current().querySelector("video")).toBeNull();
    await act(async () => button("Play video", current()).click());
    expect(requests).toEqual([first.id, second.id]);
  });

  it.each(["backend", "network"])("keeps the previous introduction on a %s failure and offers retry", async failure => {
    await mount(first.id);
    await openChoices(true);
    await choose(second.id);
    if (failure === "backend") backend.introAction.mockResolvedValueOnce({ ok: false, error: "Please retry this change." });
    else backend.introAction.mockRejectedValueOnce(new Error("Please retry this change."));
    await act(async () => button("Use as introduction video").click());
    expect(backend.introId).toBe(first.id);
    expect(current().textContent).toContain(first.title);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Please retry");
    expect(button("Use as introduction video").disabled).toBe(false);
    await act(async () => button("Use as introduction video").click());
    expect(current().textContent).toContain(second.title);
  });

  it("detaches the introduction while preserving the reusable video asset", async () => {
    await mount(first.id);
    await act(async () => button("Remove introduction video").click());
    expect(backend.introAction.mock.calls).toEqual([["coach-account", null]]);
    expect(backend.rpc).not.toHaveBeenCalled();
    expect(backend.rows).toContain(first);
    expect(document.querySelector('[aria-label="Current introduction video"]')).toBeNull();
    await openChoices();
    expect([...document.querySelectorAll("option")].map(option => option.value)).toContain(first.id);
  });

  it("locks duplicate and competing mutations during a pending introduction change", async () => {
    await mount(first.id);
    await openChoices(true);
    await choose(second.id);
    let finish!: () => void;
    backend.introAction.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ ok: true }); }));
    const apply = button("Use as introduction video");
    await act(async () => { apply.click(); apply.click(); });
    expect(backend.introAction).toHaveBeenCalledTimes(1);
    expect(button("Remove introduction video").disabled).toBe(true);
    expect(button("Upload video").disabled).toBe(true);
    expect(document.querySelector<HTMLSelectElement>("select")?.disabled).toBe(true);
    await act(async () => finish());
    expect(button("Remove introduction video").disabled).toBe(false);
  });

  it("offers only ready non-retired choices", async () => {
    await mount(null, [first, { ...second, status: "failed" }, { ...uploaded, status: "ready", retired_at: "2026-11-01" }]);
    await openChoices();
    const values = [...document.querySelectorAll("option")].map(option => option.value);
    expect(values).toEqual(["", first.id]);
  });

  it.each(["signout", "account switch"])("hides private choices at %s and ignores a late successful replacement", async boundary => {
    await mount(first.id);
    await openChoices(true);
    await choose(second.id);
    let finish!: () => void;
    backend.introAction.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ ok: true }); }));
    await act(async () => button("Use as introduction video").click());
    await act(async () => {
      if (boundary === "signout") broadcastAuthBoundary();
      else backend.authChanged!("SIGNED_IN", { user: { id: "different-account" } });
    });
    expect(document.querySelector('[aria-label="Current introduction video"]')).toBeNull();
    expect(document.querySelector("select")).toBeNull();
    await act(async () => finish());
    expect(document.querySelector('[aria-label="Current introduction video"]')).toBeNull();
    expect(document.querySelector("select")).toBeNull();
    expect(document.body.textContent).not.toContain(second.title);
  });

  it("finalizes an inline upload through the shared pipeline without automatically attaching it", async () => {
    await mount();
    await openChoices();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [new dom!.window.File(["video"], "intro.mp4", { type: "video/mp4" })] });
    const title = document.querySelector<HTMLInputElement>('input[maxlength="120"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(dom!.window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(title, "New introduction");
      title.dispatchEvent(new dom!.window.Event("input", { bubbles: true }));
      input.dispatchEvent(new dom!.window.Event("change", { bubbles: true }));
    });
    await act(async () => button("Upload video").click());
    expect(backend.rpc).toHaveBeenCalledWith("begin_coaching_video", { p_title: "New introduction", p_caption: "" });
    expect(button("Pause upload")).toBeDefined();
    expect(button("Use as introduction video").disabled).toBe(true);
    await act(async () => backend.uploadOptions!.onSuccess());
    expect(backend.finalize).toHaveBeenCalledWith("finalize-coaching-video", { body: { id: uploaded.id } });
    expect(backend.introId).toBeNull();
    await choose(uploaded.id);
    await act(async () => button("Use as introduction video").click());
    expect(current().textContent).toContain(uploaded.title);
  });

  it("does not finalize an old upload when its callback arrives after signout", async () => {
    await mount(null, [uploaded]);
    await openChoices();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [new dom!.window.File(["video"], "intro.mp4", { type: "video/mp4" })] });
    await act(async () => input.dispatchEvent(new dom!.window.Event("change", { bubbles: true })));
    await act(async () => button("Resume with selected file").click());
    const callback = backend.uploadOptions!.onSuccess;
    await act(async () => broadcastAuthBoundary());
    await act(async () => callback());
    expect(backend.finalize).not.toHaveBeenCalled();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("ignores cancelled upload callbacks after a replacement upload starts", async () => {
    await mount(null, [uploaded]);
    await openChoices();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new dom!.window.File(["video"], "first.mp4", { type: "video/mp4" })] });
    await act(async () => input.dispatchEvent(new dom!.window.Event("change", { bubbles: true })));
    await act(async () => button("Resume with selected file").click());
    const cancelled = backend.uploadOptions!;
    await act(async () => button("Cancel upload").click());
    Object.defineProperty(input, "files", { configurable: true, value: [new dom!.window.File(["video"], "replacement.mp4", { type: "video/mp4" })] });
    const title = document.querySelector<HTMLInputElement>('input[maxlength="120"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(dom!.window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(title, "Replacement upload");
      title.dispatchEvent(new dom!.window.Event("input", { bubbles: true }));
      input.dispatchEvent(new dom!.window.Event("change", { bubbles: true }));
    });
    await act(async () => button("Upload video").click());
    expect(backend.uploadOptions).not.toBe(cancelled);
    await act(async () => { cancelled.onError(); cancelled.onSuccess(); });
    expect(backend.finalize).not.toHaveBeenCalled();
    expect(button("Pause upload")).toBeDefined();
    expect(button("Cancel upload")).toBeDefined();
    expect(document.querySelector<HTMLButtonElement>('button[aria-expanded]')?.disabled).toBe(true);
  });
});
