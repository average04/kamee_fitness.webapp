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
  rpc: vi.fn(), introAction: vi.fn(), finalize: vi.fn(), inventory: vi.fn(), rows: [] as Video[], introId: null as string | null,
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
    from: () => ({ select: () => ({ is: () => ({ order: backend.inventory }) }) }),
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
  backend.inventory.mockReset().mockImplementation(async () => ({ data: [...backend.rows], error: null }));
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

async function mount(introId: string | null = null, rows = backend.rows, mode: "introduction" | "library" = "introduction") {
  backend.introId = introId;
  backend.rows = [...rows];
  dom = new JSDOM('<div id="root"></div>', { url: "https://kamee.fit/coaching/profile" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("location", dom.window.location);
  vi.stubGlobal("Element", dom.window.Element);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("confirm", vi.fn(() => false));
  Object.defineProperties(dom.window.URL, {
    createObjectURL: { configurable: true, value: vi.fn(() => "blob:local-introduction-preview") },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
  vi.stubGlobal("URL", dom.window.URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    const { id } = JSON.parse(options.body as string);
    requests.push(id);
    return Response.json({ url: `https://storage.example/${id}.mp4?token=signed` });
  });
  root = (await import("react-dom/client")).createRoot(document.getElementById("root")!);
  await act(async () => root!.render(createElement(VideoLibrary, { initial: rows, initialIntroId: introId, mode, ownerId: "coach-account" })));
  return { requests };
}

async function openChoices(current = false) {
  if (current) await act(async () => button("Change introduction video").click());
  await act(async () => button("Choose from library").click());
}

async function selectFile(name = "my-introduction.mp4", type = "video/mp4", size = 5) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  const file = new dom!.window.File(["video"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(input!, "files", { configurable: true, value: [file] });
  await act(async () => input!.dispatchEvent(new dom!.window.Event("change", { bubbles: true })));
  return input!;
}

async function setTitle(value: string) {
  const title = document.querySelector<HTMLInputElement>('input[maxlength="120"]');
  expect(title).not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom!.window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(title, value);
    title!.dispatchEvent(new dom!.window.Event("input", { bubbles: true }));
  });
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

  it("starts with an obvious file chooser and cannot upload before selecting a file", async () => {
    await mount();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(document.querySelector('[aria-label="Current introduction video"]')).toBeNull();
    expect(button("Choose video").disabled).toBe(false);
    expect(button("Upload and use as introduction").disabled).toBe(true);
    const picker = vi.spyOn(input!, "click");
    await act(async () => button("Choose video").click());
    expect(picker).toHaveBeenCalledTimes(1);
    expect(backend.introAction).not.toHaveBeenCalled();
    expect(backend.rpc).not.toHaveBeenCalled();
  });

  it("shows the uploader directly when there are no ready videos to choose", async () => {
    await mount(null, []);
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
    expect(document.querySelector("select")).toBeNull();
    expect(document.querySelector("details")).toBeNull();
    expect(button("Choose video").disabled).toBe(false);
  });

  it("shows the selected filename and local preview, fills an editable title and enables the clear final action", async () => {
    await mount(null, []);
    await selectFile("my-coaching-introduction.mp4");
    expect(document.body.textContent).toContain("my-coaching-introduction.mp4");
    expect(document.body.textContent).toMatch(/caption\s*\(optional\)/i);
    expect(button("Change video").disabled).toBe(false);
    const title = document.querySelector<HTMLInputElement>('input[maxlength="120"]')!;
    expect(title.value.trim().length).toBeGreaterThan(0);
    expect(title.disabled).toBe(false);
    const preview = document.querySelector<HTMLVideoElement>('video[src^="blob:"]');
    expect(preview).not.toBeNull();
    expect(preview!.controls).toBe(true);
    expect(preview!.muted).toBe(true);
    expect(preview!.autoplay).toBe(false);
    expect(button("Upload and use as introduction").disabled).toBe(false);
    await setTitle("   ");
    expect(button("Upload and use as introduction").disabled).toBe(true);
    expect(backend.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["intro.mov", "video/quicktime", 5],
    ["intro.mp4", "video/mp4", 50 * 1024 * 1024 + 1],
  ] as const)("prevents uploading an invalid selection %s", async (name, type, size) => {
    await mount(null, []);
    await selectFile(name, type, size);
    expect(button("Upload and use as introduction").disabled).toBe(true);
    expect(backend.rpc).not.toHaveBeenCalled();
    expect(backend.introAction).not.toHaveBeenCalled();
  });

  it("updates an untouched suggested title when the selected file changes", async () => {
    await mount(null, []);
    await selectFile("first-introduction.mp4");
    expect(document.querySelector<HTMLInputElement>('input[maxlength="120"]')?.value).toBe("first introduction");
    await selectFile("second-introduction.mp4");
    expect(document.querySelector<HTMLInputElement>('input[maxlength="120"]')?.value).toBe("second introduction");
  });

  it("derives the title from a valid MP4 after an invalid selection", async () => {
    await mount(null, []);
    await selectFile("wrong-file.mov", "video/quicktime");
    await selectFile("valid-introduction.mp4");
    expect(document.querySelector<HTMLInputElement>('input[maxlength="120"]')?.value).toBe("valid introduction");
  });

  it("preserves a deliberately edited title when choosing a replacement file", async () => {
    await mount(null, []);
    await selectFile("first-introduction.mp4");
    await setTitle("My coaching story");
    await selectFile("replacement-file.mp4");
    expect(document.querySelector<HTMLInputElement>('input[maxlength="120"]')?.value).toBe("My coaching story");
  });

  it("previews an owned ready choice and attaches only after explicit confirmation", async () => {
    const { requests } = await mount();
    await openChoices();
    await choose(second.id);
    expect(backend.introId).toBeNull();
    await act(async () => button("Play video").click());
    expect(requests).toEqual([second.id]);
    await act(async () => button("Use this video").click());
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
    await act(async () => button("Use this video").click());
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
    await act(async () => button("Use this video").click());
    expect(backend.introId).toBe(first.id);
    expect(current().textContent).toContain(first.title);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Please retry");
    expect(button("Use this video").disabled).toBe(false);
    await act(async () => button("Use this video").click());
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

  it("clears native selection and its local preview when detaching during a replacement, so the same file can be chosen again", async () => {
    await mount(first.id);
    await act(async () => button("Change introduction video").click());
    const input = await selectFile();
    // JSDOM cannot open a native picker. Model its populated native value after
    // selecting a File; the browser requires this value to clear before selecting
    // the same file can emit another change event.
    Object.defineProperty(input, "value", { configurable: true, writable: true, value: "C:\\fakepath\\my-introduction.mp4" });
    expect(document.querySelector('video[src^="blob:"]')).not.toBeNull();
    await act(async () => button("Remove introduction video").click());
    expect(document.querySelector<HTMLInputElement>('input[type="file"]')?.value).toBe("");
    expect(document.querySelector('video[src^="blob:"]')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-introduction-preview");
    expect(button("Choose video").disabled).toBe(false);
    expect(button("Upload and use as introduction").disabled).toBe(true);
  });

  it("locks duplicate and competing mutations during a pending introduction change", async () => {
    await mount(first.id);
    await openChoices(true);
    await choose(second.id);
    let finish!: () => void;
    backend.introAction.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ ok: true }); }));
    const apply = button("Use this video");
    await act(async () => { apply.click(); apply.click(); });
    expect(backend.introAction).toHaveBeenCalledTimes(1);
    expect(button("Remove introduction video").disabled).toBe(true);
    expect(button("Upload a new video").disabled).toBe(true);
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
    await act(async () => button("Use this video").click());
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

  it("uploads, validates and uses an introduction through one explicit final action", async () => {
    await mount(null, []);
    await selectFile("intro.mp4");
    await setTitle("New introduction");
    await act(async () => button("Upload and use as introduction").click());
    expect(backend.rpc).toHaveBeenCalledWith("begin_coaching_video", { p_title: "New introduction", p_caption: "" });
    expect(button("Pause upload")).toBeDefined();
    expect(backend.introAction).not.toHaveBeenCalled();
    await act(async () => backend.uploadOptions!.onSuccess());
    expect(backend.finalize).toHaveBeenCalledWith("finalize-coaching-video", { body: { id: uploaded.id } });
    expect(backend.introAction.mock.calls).toEqual([["coach-account", uploaded.id]]);
    expect(backend.introId).toBe(uploaded.id);
    expect(current().textContent).toContain(uploaded.title);
  });

  it("keeps the current introduction while a replacement validates and assigns exactly once", async () => {
    await mount(first.id);
    await act(async () => button("Change introduction video").click());
    await selectFile();
    await act(async () => button("Upload and use as introduction").click());
    let finish!: () => void;
    backend.finalize.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { finish = resolve; });
      backend.rows = backend.rows.map(video => video.id === uploaded.id ? { ...video, status: "ready" } : video);
      return { data: { ready: true }, error: null };
    });
    const callbacks = backend.uploadOptions!;
    await act(async () => { callbacks.onSuccess(); callbacks.onSuccess(); });
    expect(backend.finalize).toHaveBeenCalledTimes(1);
    expect(backend.introAction).not.toHaveBeenCalled();
    expect(current().textContent).toContain(first.title);
    expect(button("Remove introduction video").disabled).toBe(true);
    await act(async () => finish());
    expect(backend.introAction.mock.calls).toEqual([["coach-account", uploaded.id]]);
    expect(current().textContent).toContain(uploaded.title);
  });

  it("keeps finalization locked if an older post-start inventory request rejects after a fast upload", async () => {
    await mount(first.id);
    await act(async () => button("Change introduction video").click());
    await selectFile();
    let rejectOldInventory!: (reason: Error) => void;
    backend.inventory.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOldInventory = reject; }));
    let finishValidation!: () => void;
    backend.finalize.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { finishValidation = resolve; });
      backend.rows = backend.rows.map(video => video.id === uploaded.id ? { ...video, status: "ready" } : video);
      return { data: { ready: true }, error: null };
    });
    await act(async () => button("Upload and use as introduction").click());
    expect(rejectOldInventory).toBeTypeOf("function");
    await act(async () => backend.uploadOptions!.onSuccess());
    expect(button("Remove introduction video").disabled).toBe(true);
    await act(async () => rejectOldInventory(new Error("Old inventory request failed.")));
    const remainsLocked = button("Remove introduction video").disabled;
    await act(async () => button("Remove introduction video").click());
    const competingMutations = backend.introAction.mock.calls.length;
    await act(async () => finishValidation());
    expect(remainsLocked).toBe(true);
    expect(competingMutations).toBe(0);
    expect(backend.introAction.mock.calls).toEqual([["coach-account", uploaded.id]]);
  });

  it("does not let an old post-start inventory response replace the newer finalized introduction", async () => {
    await mount(first.id);
    await act(async () => button("Change introduction video").click());
    await selectFile();
    let finishOldInventory!: (result: { data: Video[]; error: null }) => void;
    backend.inventory.mockImplementationOnce(() => new Promise(resolve => { finishOldInventory = resolve; }));
    await act(async () => button("Upload and use as introduction").click());
    expect(finishOldInventory).toBeTypeOf("function");
    await act(async () => backend.uploadOptions!.onSuccess());
    expect(current().textContent).toContain(uploaded.title);
    await act(async () => finishOldInventory({ data: [first], error: null }));
    expect(current().textContent).toContain(uploaded.title);
    expect(backend.introAction.mock.calls).toEqual([["coach-account", uploaded.id]]);
  });

  it.each(["backend", "network"])("retains the current introduction when upload validation has a %s failure", async failure => {
    await mount(first.id);
    await act(async () => button("Change introduction video").click());
    await selectFile();
    await act(async () => button("Upload and use as introduction").click());
    if (failure === "backend") backend.finalize.mockResolvedValueOnce({ data: { error: "Validation failed. Retry." }, error: null });
    else backend.finalize.mockRejectedValueOnce(new Error("Validation failed. Retry."));
    await act(async () => backend.uploadOptions!.onSuccess());
    expect(backend.introId).toBe(first.id);
    expect(current().textContent).toContain(first.title);
    expect(backend.introAction).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Validation failed");
    expect(button("Choose video").disabled).toBe(false);
    await act(async () => button("Retry and use as intro").click());
    expect(backend.introAction.mock.calls).toEqual([["coach-account", uploaded.id]]);
    expect(current().textContent).toContain(uploaded.title);
    expect(backend.rpc.mock.calls.filter(([name]) => name === "begin_coaching_video")).toHaveLength(1);
  });

  it("keeps the previous introduction when the uploaded video cannot be assigned, and lets the ready video be retried", async () => {
    await mount(first.id);
    await act(async () => button("Change introduction video").click());
    await selectFile();
    await act(async () => button("Upload and use as introduction").click());
    backend.introAction.mockResolvedValueOnce({ ok: false, error: "Could not save introduction. Retry." });
    await act(async () => backend.uploadOptions!.onSuccess());
    expect(backend.introId).toBe(first.id);
    expect(current().textContent).toContain(first.title);
    expect(backend.rows.find(video => video.id === uploaded.id)?.status).toBe("ready");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not save introduction");
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Choose an introduction video"]')?.value).toBe(uploaded.id);
    expect(button("Use this video").disabled).toBe(false);
    await act(async () => button("Use this video").click());
    expect(current().textContent).toContain(uploaded.title);
    expect(backend.rpc.mock.calls.some(([name]) => name === "retire_coaching_video")).toBe(false);
  });

  it.each(["signout", "account switch"])("does not assign an uploaded introduction if %s happens during validation", async boundary => {
    await mount(first.id);
    await act(async () => button("Change introduction video").click());
    await selectFile();
    await act(async () => button("Upload and use as introduction").click());
    let finish!: () => void;
    backend.finalize.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ data: { ready: true }, error: null }); }));
    await act(async () => backend.uploadOptions!.onSuccess());
    await act(async () => {
      if (boundary === "signout") broadcastAuthBoundary();
      else backend.authChanged!("SIGNED_IN", { user: { id: "different-account" } });
    });
    await act(async () => finish());
    expect(backend.introAction).not.toHaveBeenCalled();
    expect(document.querySelector('[aria-label="Current introduction video"]')).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("keeps a library-mode upload separate from profile introduction selection", async () => {
    await mount(null, [], "library");
    await selectFile();
    await setTitle("Library video");
    await act(async () => button("Upload video").click());
    await act(async () => backend.uploadOptions!.onSuccess());
    expect(backend.finalize).toHaveBeenCalledWith("finalize-coaching-video", { body: { id: uploaded.id } });
    expect(backend.introAction).not.toHaveBeenCalled();
    expect(backend.introId).toBeNull();
  });

  it("makes resuming and using an introduction explicit before assigning the validated video", async () => {
    await mount(null, [uploaded]);
    await selectFile("intro.mp4");
    expect([...document.querySelectorAll("button")].some(element => element.textContent?.trim() === "Resume with selected file")).toBe(false);
    await act(async () => button("Resume and use as introduction").click());
    expect(backend.introAction).not.toHaveBeenCalled();
    await act(async () => backend.uploadOptions!.onSuccess());
    expect(backend.finalize).toHaveBeenCalledWith("finalize-coaching-video", { body: { id: uploaded.id } });
    expect(backend.introAction.mock.calls).toEqual([["coach-account", uploaded.id]]);
    expect(current().textContent).toContain(uploaded.title);
  });

  it("resumes and validates a library video without automatically changing the profile introduction", async () => {
    await mount(null, [uploaded], "library");
    await selectFile("library.mp4");
    await act(async () => button("Resume with selected file").click());
    await act(async () => backend.uploadOptions!.onSuccess());
    expect(backend.finalize).toHaveBeenCalledWith("finalize-coaching-video", { body: { id: uploaded.id } });
    expect(backend.introAction).not.toHaveBeenCalled();
    expect(backend.introId).toBeNull();
  });

  it.each(["select", "remove"])("preserves a pending library upload draft when %s changes the profile introduction", async action => {
    await mount(first.id, [first, second], "library");
    await selectFile("pending-library-upload.mp4");
    await setTitle("My pending library upload");
    const caption = document.querySelector<HTMLInputElement>('input[maxlength="200"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(dom!.window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(caption, "Keep this draft caption");
      caption.dispatchEvent(new dom!.window.Event("input", { bubbles: true }));
    });
    await act(async () => button(action === "select" ? "Use as profile intro" : "Remove profile intro").click());
    expect(backend.introAction).toHaveBeenCalledWith("coach-account", action === "select" ? second.id : null);
    expect(document.body.textContent).toContain("pending-library-upload.mp4");
    expect(document.querySelector<HTMLInputElement>('input[maxlength="120"]')?.value).toBe("My pending library upload");
    expect(document.querySelector<HTMLInputElement>('input[maxlength="200"]')?.value).toBe("Keep this draft caption");
    expect(button("Upload video").disabled).toBe(false);
  });

  it("does not finalize an old upload when its callback arrives after signout", async () => {
    await mount(null, [uploaded]);
    await selectFile("intro.mp4");
    await act(async () => button("Resume and use as introduction").click());
    const callback = backend.uploadOptions!.onSuccess;
    await act(async () => broadcastAuthBoundary());
    await act(async () => callback());
    expect(backend.finalize).not.toHaveBeenCalled();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("ignores cancelled upload callbacks after a replacement upload starts", async () => {
    await mount(null, [uploaded]);
    await selectFile("first.mp4");
    await act(async () => button("Resume and use as introduction").click());
    const cancelled = backend.uploadOptions!;
    await act(async () => button("Cancel upload").click());
    await selectFile("replacement.mp4");
    await setTitle("Replacement upload");
    await act(async () => button("Upload and use as introduction").click());
    expect(backend.uploadOptions).not.toBe(cancelled);
    await act(async () => { cancelled.onError(); cancelled.onSuccess(); });
    expect(backend.finalize).not.toHaveBeenCalled();
    expect(button("Pause upload")).toBeDefined();
    expect(button("Cancel upload")).toBeDefined();
    expect(button("Change video").disabled).toBe(true);
  });
});
