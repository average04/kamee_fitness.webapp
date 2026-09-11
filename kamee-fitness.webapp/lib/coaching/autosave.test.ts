import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaveController, shallowEqual, type SaveState } from "./autosave";
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

  it("dispose() flushes a pending debounced save instead of dropping the last edit", () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.update("a");
    c.dispose();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("a");

    // The (now-cancelled) timer's original delay elapsing must not fire a second save.
    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("dispose() is a no-op when nothing is pending (never edited, or already settled)", () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.dispose();
    expect(save).not.toHaveBeenCalled();
  });

  it("update() that lands while a save is in flight is queued once its debounce timer fires", async () => {
    const first = deferred<FormState>();
    const save = vi.fn<(input: string) => Promise<FormState>>().mockReturnValueOnce(first.promise);
    const c = createAutosaveController<string>({ save, debounceMs: 800, onStateChange: () => {} });

    c.saveNow("a");
    expect(save).toHaveBeenCalledTimes(1);

    c.update("b");
    vi.advanceTimersByTime(800);
    // The debounce timer fired and called trigger("b"), but "a" is still in
    // flight, so it must have been queued rather than started immediately.
    expect(save).toHaveBeenCalledTimes(1);

    const second = deferred<FormState>();
    save.mockReturnValueOnce(second.promise);
    first.resolve({ savedAt: "t1" });

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("b");
    second.resolve({ savedAt: "t2" });
  });

  it("a queued save still runs after the in-flight save settles with an error", async () => {
    const first = deferred<FormState>();
    const save = vi.fn<(input: string) => Promise<FormState>>().mockReturnValueOnce(first.promise);
    const states: SaveState[] = [];
    const c = createAutosaveController<string>({ save, onStateChange: (s) => states.push(s) });

    c.saveNow("a");
    c.saveNow("b"); // queued while "a" is in flight

    const second = deferred<FormState>();
    save.mockReturnValueOnce(second.promise);
    first.resolve({ message: "boom" }); // "a" fails

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("b");

    second.resolve({ savedAt: "t2" });
    await vi.waitFor(() => expect(states.at(-1)).toBe("saved"));
  });

  it("skips a save whose input matches the last successfully saved snapshot", async () => {
    const save = vi.fn<(input: { a: number }) => Promise<FormState>>(async () => ({ savedAt: "t" }));
    const c = createAutosaveController<{ a: number }>({ save, onStateChange: () => {} });

    c.saveNow({ a: 1 });
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    c.saveNow({ a: 1 }); // unchanged since the last successful save
    expect(save).toHaveBeenCalledTimes(1);

    c.saveNow({ a: 2 }); // actually changed
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });

  it("does not skip a repeat of an input whose last save failed", async () => {
    const save = vi.fn<(input: string) => Promise<FormState>>(async () => ({ message: "boom" }));
    const c = createAutosaveController<string>({ save, onStateChange: () => {} });

    c.saveNow("a");
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    c.saveNow("a"); // retry of the same input -- must not be treated as "unchanged"
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
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

describe("shallowEqual", () => {
  it("compares primitives with Object.is", () => {
    expect(shallowEqual("a", "a")).toBe(true);
    expect(shallowEqual(1, 2)).toBe(false);
    expect(shallowEqual(NaN, NaN)).toBe(true);
  });

  it("compares flat objects key by key", () => {
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "y" })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("treats null/non-object mismatches as unequal", () => {
    expect(shallowEqual<unknown>(null, {})).toBe(false);
    expect(shallowEqual<unknown>({}, null)).toBe(false);
    expect(shallowEqual<unknown>("a", { a: 1 })).toBe(false);
  });
});
