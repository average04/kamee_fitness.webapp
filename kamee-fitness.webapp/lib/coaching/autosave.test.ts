import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaveController, type SaveState } from "./autosave";
import type { FormState } from "./profile";

/** A promise plus externally-callable resolve/reject, for controlling when an in-flight save settles. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutosaveController", () => {
  it("debounces update() calls: only the last input within debounceMs is saved", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: (s) => states.push(s) });

    c.update("a");
    vi.advanceTimersByTime(300);
    c.update("b");
    vi.advanceTimersByTime(300);
    c.update("c");
    vi.advanceTimersByTime(799);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("c");
  });

  it("calls onStateChange('saving') then 'saved' on a successful save", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("x");
    expect(states).toEqual(["saving"]);
    await vi.waitFor(() => expect(states).toEqual(["saving", "saved"]));
  });

  it("calls onStateChange('error') when the save result carries a message", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ message: "nope" }));
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("x");
    await vi.waitFor(() => expect(states).toEqual(["saving", "error"]));
  });

  it("calls onStateChange('error') when the save result carries field errors", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({
      errors: { headline: "too long" },
    }));
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("x");
    await vi.waitFor(() => expect(states).toEqual(["saving", "error"]));
  });

  it("calls onStateChange('error') when the save promise rejects", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => {
      throw new Error("network down");
    });
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("x");
    await vi.waitFor(() => expect(states).toEqual(["saving", "error"]));
  });

  it("saveNow() bypasses the debounce timer and fires immediately", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.update("a");
    c.saveNow("b");
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("b");

    // The pending debounce timer for "a" must have been cancelled by saveNow.
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("never overlaps saves: a call while one is in flight queues only the latest input for one follow-up save", async () => {
    const first = deferred<FormState>();
    const save = vi.fn<(input: string) => Promise<FormState>>().mockReturnValueOnce(first.promise);
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("a");
    expect(save).toHaveBeenCalledTimes(1);

    // Fires while "a" is still in flight -- must queue, not call save again yet.
    c.saveNow("b");
    c.saveNow("c");
    expect(save).toHaveBeenCalledTimes(1);

    const second = deferred<FormState>();
    save.mockReturnValueOnce(second.promise);
    first.resolve({ savedAt: "t1" });

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("c");

    second.resolve({ savedAt: "t2" });
    await vi.waitFor(() => expect(states.at(-1)).toBe("saved"));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("dispose() cancels a pending debounced save", () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.update("a");
    c.dispose();
    vi.advanceTimersByTime(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it("passes the full result to onResult", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({
      errors: { about: "too short" },
    }));
    let last: FormState | undefined;
    const c = createAutosaveController<string>({
      save,
      onStateChange: () => {},
      onResult: (r) => {
        last = r;
      },
    });

    c.saveNow("x");
    await vi.waitFor(() => expect(last).toEqual({ errors: { about: "too short" } }));
  });
});
