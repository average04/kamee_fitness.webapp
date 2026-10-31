import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTurnstile, startTurnstileVerification, type TurnstileApi, type VerificationState } from "./turnstile-verification";

function provider() {
  const widgets = new Map<string, Parameters<TurnstileApi["render"]>[1]>();
  let nextId = 0;
  const api: TurnstileApi = {
    render: (_container, options) => { const id = String(++nextId); widgets.set(id, options); return id; },
    remove: (id) => { widgets.delete(id); },
  };
  return { api, widgets };
}

function start(api: TurnstileApi, load = async () => api) {
  const states: VerificationState[] = [];
  const session = startTurnstileVerification({} as HTMLElement, {
    sitekey: "real-site-key-placeholder", hostname: "127.0.0.1", theme: "dark",
    onChange: (state) => states.push(state),
  }, load);
  return { session, states, latest: () => states.at(-1)! };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("sign-in verification lifecycle", () => {
  it("reports an unauthorized domain and refuses a token after the failed attempt", async () => {
    const { api, widgets } = provider();
    const { session, latest } = start(api);
    await Promise.resolve();
    const callbacks = widgets.get("1")!;
    callbacks["error-callback"]("110200");
    expect(latest().phase).toBe("error");
    expect(latest().message).toMatch(/127\.0\.0\.1.*110200|110200.*127\.0\.0\.1/);
    expect(latest().message).toMatch(/allow|authoriz/i);
    callbacks.callback("late-token");
    expect(session.consumeToken()).toBeNull();
    session.dispose();
  });

  it("allows a successful token only once", async () => {
    const { api, widgets } = provider();
    const { session, latest } = start(api);
    expect(session.consumeToken()).toBeNull();
    await Promise.resolve();
    widgets.get("1")!.callback("verified-token");
    expect(latest().phase).toBe("verified");
    expect(session.consumeToken()).toBe("verified-token");
    expect(session.consumeToken()).toBeNull();
    session.dispose();
  });

  it("invalidates a successful token on expiry and offers retry", async () => {
    const { api, widgets } = provider();
    const { session, latest } = start(api);
    await Promise.resolve();
    widgets.get("1")!.callback("expired-token");
    widgets.get("1")!["expired-callback"]();
    expect(session.consumeToken()).toBeNull();
    expect(latest().phase).toBe("error");
    expect(latest().message).toMatch(/expired.*retry/i);
    session.dispose();
  });

  it("removes the previous widget and ignores its callbacks during a manual retry", async () => {
    const { api, widgets } = provider();
    const first = start(api);
    await Promise.resolve();
    const stale = widgets.get("1")!;
    stale["error-callback"]("300030");
    first.session.dispose();
    expect(widgets.size).toBe(0);
    const second = start(api);
    await Promise.resolve();
    stale.callback("stale-token");
    stale["error-callback"]("110200");
    expect(second.latest().phase).toBe("verifying");
    expect(second.session.consumeToken()).toBeNull();
    widgets.get("2")!.callback("fresh-token");
    expect(second.session.consumeToken()).toBe("fresh-token");
    second.session.dispose();
  });

  it("does not mount a widget when loading finishes after effect cleanup", async () => {
    const { api, widgets } = provider();
    let finish!: (value: TurnstileApi) => void;
    const pending = new Promise<TurnstileApi>((resolve) => { finish = resolve; });
    const { session, states } = start(api, () => pending);
    session.dispose();
    finish(api);
    await Promise.resolve();
    expect(widgets.size).toBe(0);
    expect(states).toHaveLength(1);
    expect(session.consumeToken()).toBeNull();
  });

  it("reports a script loading failure instead of staying in a waiting state", async () => {
    const { api } = provider();
    const { session, latest } = start(api, async () => { throw new Error("Verification could not load. Retry verification."); });
    await Promise.resolve();
    await Promise.resolve();
    expect(latest().phase).toBe("error");
    expect(latest().message).toMatch(/load.*retry/i);
    expect(session.consumeToken()).toBeNull();
    session.dispose();
  });
});

describe("verification script loading", () => {
  function browser() {
    class Script extends EventTarget {
      src = ""; async = false; defer = false;
      remove() { if (script === this) script = null; }
    }
    let script: Script | null = null;
    const win: { turnstile?: TurnstileApi } = {};
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", {
      querySelector: () => script,
      createElement: () => new Script(),
      head: { appendChild: (value: Script) => { script = value; } },
    });
    return { win, current: () => script };
  }

  it("times out a blocked script, removes it, and permits a fresh successful load", async () => {
    vi.useFakeTimers();
    const page = browser();
    const first = loadTurnstile(new AbortController().signal);
    const rejection = expect(first).rejects.toThrow(/load.*retry/i);
    await vi.advanceTimersByTimeAsync(15_000);
    await rejection;
    expect(page.current()).toBeNull();
    const second = loadTurnstile(new AbortController().signal);
    const { api } = provider();
    page.win.turnstile = api;
    page.current()!.dispatchEvent(new Event("load"));
    expect(await second).toBe(api);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles a network script failure immediately and cleans up listeners on abort", async () => {
    vi.useFakeTimers();
    const page = browser();
    const failed = loadTurnstile(new AbortController().signal);
    const rejection = expect(failed).rejects.toThrow(/load.*retry/i);
    page.current()!.dispatchEvent(new Event("error"));
    await rejection;
    const controller = new AbortController();
    const cancelled = loadTurnstile(controller.signal);
    const cancellation = expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await cancellation;
    expect(vi.getTimerCount()).toBe(0);
  });
});
